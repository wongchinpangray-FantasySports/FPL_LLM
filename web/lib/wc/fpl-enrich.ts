import type { SupabaseClient } from "@supabase/supabase-js";

const FPL_COLS =
  "fpl_id,web_name,name,position,base_price,form,goals_scored,assists,expected_goals,expected_assists,minutes";

function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Link FIFA pool to FPL `players_static` by normalized name for xG/xA/form. */
export async function enrichWcPlayersFromFpl(
  supa: SupabaseClient,
): Promise<{ matched: number }> {
  const { data: wcRows, error: wErr } = await supa
    .from("wc_players")
    .select("id,name,fpl_id,source")
    .eq("source", "fifa");
  if (wErr) throw new Error(wErr.message);

  const { data: fplRows, error: fErr } = await supa
    .from("players_static")
    .select(FPL_COLS);
  if (fErr) throw new Error(fErr.message);

  const byNorm = new Map<string, (typeof fplRows)[0][]>();
  for (const r of fplRows ?? []) {
    const label = (r.web_name as string) ?? (r.name as string) ?? "";
    const key = normName(label);
    if (!key) continue;
    const list = byNorm.get(key) ?? [];
    list.push(r);
    byNorm.set(key, list);
  }

  let matched = 0;
  const BATCH = 100;
  const pending: {
    id: number;
    fpl_id: number;
    goals: number;
    assists: number;
    xg: number;
    xa: number;
    form: number;
    minutes: number;
  }[] = [];

  for (const w of wcRows ?? []) {
    if (w.fpl_id != null) continue;
    const key = normName(w.name as string);
    const hits = byNorm.get(key);
    if (!hits || hits.length !== 1) continue;

    const f = hits[0]!;
    pending.push({
      id: w.id as number,
      fpl_id: f.fpl_id as number,
      goals: num(f.goals_scored),
      assists: num(f.assists),
      xg: num(f.expected_goals),
      xa: num(f.expected_assists),
      form: num(f.form),
      minutes: num(f.minutes),
    });
    matched++;
  }

  for (let i = 0; i < pending.length; i += BATCH) {
    const chunk = pending.slice(i, i + BATCH);
    for (const row of chunk) {
      const { error } = await supa
        .from("wc_players")
        .update({
          fpl_id: row.fpl_id,
          goals: row.goals,
          assists: row.assists,
          xg: row.xg,
          xa: row.xa,
          form: row.form,
          minutes: row.minutes,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  return { matched };
}
