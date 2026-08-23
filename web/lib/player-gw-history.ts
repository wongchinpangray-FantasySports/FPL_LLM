import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason, isFplSeasonKey } from "@/lib/fpl-season";
import { fplDcPoints } from "@/lib/fpl/dc-points";

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
  defcon_points?: number;
  fixture?: {
    opp: string;
    home: boolean;
    fdr: number | null;
  } | null;
};

export type PlayerGwFixtureInfo = {
  opp: string;
  home: boolean;
  fdr: number | null;
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
  /** When set (e.g. `"2024"`), load that campaign's GW rows; otherwise active season. */
  fplSeason?: string,
): Promise<PlayerGwHistoryRow[]> {
  if (!Number.isFinite(fplId) || fplId <= 0) return [];

  const lim = Math.min(Math.max(Math.floor(limit), 1), 10);
  const season =
    fplSeason != null && isFplSeasonKey(fplSeason)
      ? fplSeason.trim()
      : await getCurrentFplSeason();
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("player_gw_stats")
    .select(GW_STATS_SELECT)
    .eq("season", season)
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

/**
 * Opponent + home/away for each GW a club played (includes finished fixtures).
 */
export async function loadPlayerGwFixtures(
  teamId: number,
  gws: number[],
  fplSeason?: string,
): Promise<Map<number, PlayerGwFixtureInfo>> {
  if (!Number.isFinite(teamId) || teamId <= 0 || gws.length === 0) {
    return new Map();
  }

  const season =
    fplSeason != null && isFplSeasonKey(fplSeason)
      ? fplSeason.trim()
      : await getCurrentFplSeason();
  const uniqueGws = [...new Set(gws.filter((gw) => Number.isFinite(gw) && gw > 0))];
  if (uniqueGws.length === 0) return new Map();

  const minGw = Math.min(...uniqueGws);
  const maxGw = Math.max(...uniqueGws);
  const supa = getServerSupabase();

  const { data: fixtures, error } = await supa
    .from("fixtures")
    .select("gw,home_team_id,away_team_id,home_fdr,away_fdr")
    .eq("season", season)
    .gte("gw", minGw)
    .lte("gw", maxGw);

  if (error || !fixtures?.length) return new Map();

  const teamIds = new Set<number>();
  for (const fx of fixtures) {
    teamIds.add(fx.home_team_id as number);
    teamIds.add(fx.away_team_id as number);
  }

  const { data: teamRows } = await supa
    .from("teams")
    .select("id,short_name")
    .in("id", Array.from(teamIds));

  const shortById = new Map(
    (teamRows ?? []).map((t) => [
      t.id as number,
      String(t.short_name ?? "").toUpperCase(),
    ]),
  );

  const out = new Map<number, PlayerGwFixtureInfo>();
  for (const fx of fixtures) {
    const gw = Math.floor(num(fx.gw));
    if (!uniqueGws.includes(gw)) continue;

    const homeId = fx.home_team_id as number;
    const awayId = fx.away_team_id as number;
    let info: PlayerGwFixtureInfo | null = null;

    if (homeId === teamId) {
      const fdrVal = num(fx.home_fdr);
      info = {
        opp: shortById.get(awayId) ?? "?",
        home: true,
        fdr: fdrVal > 0 ? fdrVal : null,
      };
    } else if (awayId === teamId) {
      const fdrVal = num(fx.away_fdr);
      info = {
        opp: shortById.get(homeId) ?? "?",
        home: false,
        fdr: fdrVal > 0 ? fdrVal : null,
      };
    }

    if (!info) continue;

    const prev = out.get(gw);
    if (!prev) {
      out.set(gw, info);
      continue;
    }
    out.set(gw, {
      opp: prev.opp.includes(info.opp) ? prev.opp : `${prev.opp}/${info.opp}`,
      home: prev.home,
      fdr: prev.fdr ?? info.fdr,
    });
  }

  return out;
}

export async function loadPlayerGwHistoryWithFixtures(
  fplId: number,
  teamId: number | null,
  limit = 10,
  fplSeason?: string,
  position?: string | null,
): Promise<PlayerGwHistoryRow[]> {
  const rows = await loadPlayerGwHistory(fplId, limit, fplSeason);
  if (rows.length === 0) return rows;

  const fixtureMap =
    teamId != null && teamId > 0
      ? await loadPlayerGwFixtures(
          teamId,
          rows.map((r) => r.gw),
          fplSeason,
        )
      : new Map<number, PlayerGwFixtureInfo>();

  return rows.map((row) => ({
    ...row,
    fixture: fixtureMap.get(row.gw) ?? null,
    defcon_points: fplDcPoints(position, row.defensive_contribution),
  }));
}
