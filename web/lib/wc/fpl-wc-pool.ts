import type { SupabaseClient } from "@supabase/supabase-js";
import { WC_PLAYER_SEEDS } from "@/lib/wc/seed-data";
import {
  WC_INTERNATIONAL_NAME_HINTS,
  nameMatchesHint,
} from "@/lib/wc/international-names";

const PLAYER_COLS =
  "fpl_id,web_name,name,position,base_price,form,goals_scored,assists,expected_goals,expected_assists,minutes";

type PlayerRow = {
  wc_team_id: number;
  name: string;
  fpl_id: number | null;
  fifa_element_id: null;
  position: string;
  price: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  form: number;
  minutes: number;
  source: string;
};

function num(v: unknown, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Expand pool from FPL DB using international name hints + manual seeds. */
export async function buildExpandedWcPlayerRows(
  supa: SupabaseClient,
  teamByCode: Map<string, number>,
  validCodes: Set<string>,
): Promise<PlayerRow[]> {
  const { data: fplRows } = await supa.from("players_static").select(PLAYER_COLS);

  const byKey = new Map<string, PlayerRow>();

  for (const [teamCode, hints] of Object.entries(WC_INTERNATIONAL_NAME_HINTS)) {
    if (!validCodes.has(teamCode)) continue;
    const wc_team_id = teamByCode.get(teamCode);
    if (wc_team_id == null) continue;

    for (const r of fplRows ?? []) {
      const label = (r.web_name as string) ?? (r.name as string) ?? "";
      if (!nameMatchesHint(label, hints)) continue;
      const fpl_id = r.fpl_id as number;
      const key = `fpl:${fpl_id}`;
      if (byKey.has(key)) continue;

      byKey.set(key, {
        wc_team_id,
        name: label,
        fpl_id,
        fifa_element_id: null,
        position: r.position as string,
        price: num(r.base_price, 5),
        goals: num(r.goals_scored),
        assists: num(r.assists),
        xg: num(r.expected_goals),
        xa: num(r.expected_assists),
        form: num(r.form),
        minutes: num(r.minutes),
        source: "fpl",
      });
    }
  }

  for (const p of WC_PLAYER_SEEDS.filter((s) => validCodes.has(s.teamCode))) {
    const wc_team_id = teamByCode.get(p.teamCode);
    if (wc_team_id == null) continue;

    const fpl =
      p.fpl_id != null
        ? (fplRows ?? []).find((r) => r.fpl_id === p.fpl_id)
        : undefined;
    const name = (fpl?.web_name as string) ?? p.name;
    const key =
      p.fpl_id != null ? `fpl:${p.fpl_id}` : `seed:${p.teamCode}:${name.toLowerCase()}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      wc_team_id,
      name,
      fpl_id: p.fpl_id ?? null,
      fifa_element_id: null,
      position: (fpl?.position as string) ?? p.position,
      price: num(fpl?.base_price, p.price ?? 6),
      goals: num(fpl?.goals_scored, p.goals ?? 0),
      assists: num(fpl?.assists, p.assists ?? 0),
      xg: num(fpl?.expected_goals, p.xg ?? 0),
      xa: num(fpl?.expected_assists, p.xa ?? 0),
      form: num(fpl?.form, p.form ?? 0),
      minutes: num(fpl?.minutes, p.minutes ?? 0),
      source: p.fpl_id != null ? "fpl" : "seed",
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function replaceExpandedWcPlayers(
  supa: SupabaseClient,
  teamByCode: Map<string, number>,
  validCodes: Set<string>,
): Promise<number> {
  const rows = await buildExpandedWcPlayerRows(supa, teamByCode, validCodes);
  if (rows.length === 0) return 0;

  await supa.from("wc_players").delete().neq("source", "fifa");
  const { error } = await supa.from("wc_players").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
