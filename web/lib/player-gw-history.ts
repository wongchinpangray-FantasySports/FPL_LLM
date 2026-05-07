import { getServerSupabase } from "@/lib/supabase";

const GW_STATS_SELECT = [
  "gw",
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "saves",
  "bonus",
  "bps",
  "expected_goals",
  "expected_assists",
  "total_points",
  "ict_index",
  "defensive_contribution",
].join(",");

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/** Per-GW FPL stats from `player_gw_stats` (same sync as rolling / compare tools). */
export type PlayerGwHistoryRow = {
  gw: number;
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  saves: number;
  bonus: number;
  bps: number;
  expected_goals: number;
  expected_assists: number;
  total_points: number;
  ict_index: number;
  defensive_contribution: number;
};

function normalizeRow(r: Record<string, unknown>): PlayerGwHistoryRow {
  return {
    gw: Math.floor(num(r.gw)),
    minutes: num(r.minutes),
    goals_scored: num(r.goals_scored),
    assists: num(r.assists),
    clean_sheets: num(r.clean_sheets),
    saves: num(r.saves),
    bonus: num(r.bonus),
    bps: num(r.bps),
    expected_goals: num(r.expected_goals),
    expected_assists: num(r.expected_assists),
    total_points: num(r.total_points),
    ict_index: num(r.ict_index),
    defensive_contribution: num(r.defensive_contribution),
  };
}

/**
 * Most recent `limit` gameweeks for one player, ascending by GW (for charts).
 * Cap 10 — enough for “last 10” chart windows.
 */
export async function loadPlayerGwHistory(
  fplId: number,
  limit = 10,
): Promise<PlayerGwHistoryRow[]> {
  if (!Number.isFinite(fplId) || fplId <= 0) return [];

  const lim = Math.min(Math.max(Math.floor(limit), 1), 10);
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("player_gw_stats")
    .select(GW_STATS_SELECT)
    .eq("player_id", fplId)
    .order("gw", { ascending: false })
    .limit(lim);

  if (error || !data?.length) return [];

  const chronological = [...data].sort(
    (a, b) =>
      num((a as unknown as Record<string, unknown>).gw) -
      num((b as unknown as Record<string, unknown>).gw),
  );
  return chronological.map((row) =>
    normalizeRow(row as unknown as Record<string, unknown>),
  );
}
