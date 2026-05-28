import type { SupabaseClient } from "@supabase/supabase-js";
import { WC_GROUP_TEAMS, WC_PLAYER_SEEDS } from "@/lib/wc/seed-data";

const PLAYER_COLS =
  "fpl_id,web_name,name,position,base_price,form,goals_scored,assists,expected_goals,expected_assists,minutes";

/** Explicit FPL id → WC nation (no fuzzy name matching — avoids wrong club players). */
export const FPL_ID_TO_WC_TEAM: Record<number, string> = Object.fromEntries(
  WC_PLAYER_SEEDS.filter((p) => p.fpl_id != null).map((p) => [
    p.fpl_id!,
    p.teamCode,
  ]),
);

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

export async function buildExpandedWcPlayerRows(
  supa: SupabaseClient,
  teamByCode: Map<string, number>,
  validCodes: Set<string>,
): Promise<PlayerRow[]> {
  const fplIds = Object.keys(FPL_ID_TO_WC_TEAM).map(Number);
  const { data: fplRows } =
    fplIds.length > 0
      ? await supa.from("players_static").select(PLAYER_COLS).in("fpl_id", fplIds)
      : { data: [] };

  const fplById = new Map(
    (fplRows ?? []).map((r) => [r.fpl_id as number, r]),
  );

  const byKey = new Map<string, PlayerRow>();

  for (const [fplIdStr, teamCode] of Object.entries(FPL_ID_TO_WC_TEAM)) {
    if (!validCodes.has(teamCode)) continue;
    const wc_team_id = teamByCode.get(teamCode);
    if (wc_team_id == null) continue;

    const fpl_id = Number(fplIdStr);
    const r = fplById.get(fpl_id);
    const label = (r?.web_name as string) ?? (r?.name as string) ?? `Player ${fpl_id}`;

    byKey.set(`fpl:${fpl_id}`, {
      wc_team_id,
      name: label,
      fpl_id,
      fifa_element_id: null,
      position: (r?.position as string) ?? "MID",
      price: num(r?.base_price, 5),
      goals: num(r?.goals_scored),
      assists: num(r?.assists),
      xg: num(r?.expected_goals),
      xa: num(r?.expected_assists),
      form: num(r?.form),
      minutes: num(r?.minutes),
      source: "fpl",
    });
  }

  for (const p of WC_PLAYER_SEEDS.filter((s) => validCodes.has(s.teamCode))) {
    const wc_team_id = teamByCode.get(p.teamCode);
    if (wc_team_id == null) continue;

    if (p.fpl_id != null) continue;

    const key = `seed:${p.teamCode}:${p.name.toLowerCase()}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      wc_team_id,
      name: p.name,
      fpl_id: null,
      fifa_element_id: null,
      position: p.position,
      price: p.price ?? 6,
      goals: p.goals ?? 0,
      assists: p.assists ?? 0,
      xg: p.xg ?? 0,
      xa: p.xa ?? 0,
      form: p.form ?? 0,
      minutes: p.minutes ?? 0,
      source: "seed",
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Rebuild curated pool (drops legacy fuzzy-matched rows). */
export async function replaceExpandedWcPlayers(
  supa: SupabaseClient,
  teamByCode: Map<string, number>,
  validCodes: Set<string>,
): Promise<number> {
  const rows = await buildExpandedWcPlayerRows(supa, teamByCode, validCodes);
  if (rows.length === 0) return 0;

  await supa.from("wc_players").delete().in("source", ["fpl", "seed"]);
  const { error } = await supa.from("wc_players").insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}
