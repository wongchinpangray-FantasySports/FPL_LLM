import { getServerSupabase } from "@/lib/supabase";
import {
  projectPlayers,
  resolveCurrentGw,
  type PlayerProjection,
} from "@/lib/xp";

/** Columns needed for the public player hub (FPL-native profile). */
const PLAYER_HUB_STATIC_COLS = [
  "fpl_id",
  "web_name",
  "name",
  "team",
  "team_id",
  "position",
  "base_price",
  "status",
  "chance_of_playing",
  "form",
  "points_per_game",
  "total_points",
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "bonus",
  "bps",
  "selected_by_percent",
  "news",
  "transfers_in_event",
  "transfers_out_event",
  "ict_index",
  "influence",
  "creativity",
  "threat",
  "expected_goals",
  "expected_assists",
].join(",");

export type PlayerHubStatic = {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  status: string | null;
  chance_of_playing: number | null;
  form: number | null;
  points_per_game: number | null;
  total_points: number | null;
  minutes: number | null;
  goals_scored: number | null;
  assists: number | null;
  clean_sheets: number | null;
  bonus: number | null;
  bps: number | null;
  selected_by_percent: number | null;
  news: string | null;
  transfers_in_event: number | null;
  transfers_out_event: number | null;
  ict_index: number | null;
  influence: number | null;
  creativity: number | null;
  threat: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
};

export type PlayerHubPayload = {
  static: PlayerHubStatic;
  projection: PlayerProjection;
  currentGw: number;
  fromGw: number;
  toGw: number;
  horizon: number;
};

/**
 * Load static row + xP projection window for a single FPL player (server-only).
 */
export async function loadPlayerHubData(
  fplId: number,
  horizon: number,
): Promise<PlayerHubPayload | null> {
  if (!Number.isFinite(fplId) || fplId <= 0) return null;

  const supa = getServerSupabase();
  const { data: row, error } = await supa
    .from("players_static")
    .select(PLAYER_HUB_STATIC_COLS)
    .eq("fpl_id", fplId)
    .maybeSingle();

  if (error || !row) return null;

  const { current } = await resolveCurrentGw();
  const h = Math.min(8, Math.max(1, horizon));
  const fromGw = current + 1;
  const toGw = fromGw + h - 1;

  const projections = await projectPlayers([fplId], {
    currentGw: current,
    fromGw,
    toGw,
  });
  const projection = projections.get(fplId);
  if (!projection) return null;

  return {
    static: row as unknown as PlayerHubStatic,
    projection,
    currentGw: current,
    fromGw,
    toGw,
    horizon: h,
  };
}

/** Season-total Understat match rows matched to this FPL player (sync job). */
export type UnderstatSeasonAggregate = {
  season: string;
  matches: number;
  minutes: number;
  xg: number;
  xa: number;
  shots: number;
  key_passes: number;
  goals: number;
  assists: number;
};

/** Six 0–100 scores vs same-position peers (p95 scale). */
export type PlayerRadarAxes = {
  form: number;
  influence: number;
  creativity: number;
  threat: number;
  xg: number;
  xa: number;
};

const RADAR_KEYS = [
  "form",
  "influence",
  "creativity",
  "threat",
  "expected_goals",
  "expected_assists",
] as const;

function p95FromSorted(sorted: number[]): number {
  if (sorted.length === 0) return 1;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return Math.max(sorted[i]!, 1e-6);
}

export async function loadPeerP95ForPosition(
  position: string,
): Promise<Record<(typeof RADAR_KEYS)[number], number>> {
  const pos = ["GKP", "DEF", "MID", "FWD"].includes(position) ? position : "MID";
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "form,influence,creativity,threat,expected_goals,expected_assists,minutes",
    )
    .eq("position", pos)
    .gt("minutes", 0);

  const out: Record<(typeof RADAR_KEYS)[number], number> = {
    form: 1,
    influence: 1,
    creativity: 1,
    threat: 1,
    expected_goals: 1,
    expected_assists: 1,
  };
  if (error || !data?.length) return out;

  for (const key of RADAR_KEYS) {
    const vals = data
      .map((r) => Number((r as Record<string, unknown>)[key]) || 0)
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    out[key] = p95FromSorted(vals);
  }
  return out;
}

export function buildPlayerRadarAxes(
  row: PlayerHubStatic,
  peerP95: Record<(typeof RADAR_KEYS)[number], number>,
): PlayerRadarAxes {
  const pct = (v: number | null | undefined, key: (typeof RADAR_KEYS)[number]) => {
    const raw = Math.max(0, Number(v) || 0);
    const cap = peerP95[key] ?? 1;
    return Math.min(100, Math.round((raw / cap) * 100));
  };
  return {
    form: pct(row.form, "form"),
    influence: pct(row.influence, "influence"),
    creativity: pct(row.creativity, "creativity"),
    threat: pct(row.threat, "threat"),
    xg: pct(row.expected_goals, "expected_goals"),
    xa: pct(row.expected_assists, "expected_assists"),
  };
}

export async function loadUnderstatSeasonAggregate(
  fplId: number,
): Promise<UnderstatSeasonAggregate | null> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("understat_xg")
    .select("season,xg,xa,shots,key_passes,minutes,goals,assists")
    .eq("matched_fpl_id", fplId);

  if (error || !data?.length) return null;

  const bySeason = new Map<
    string,
    Array<{
      season: string;
      xg: unknown;
      xa: unknown;
      shots: unknown;
      key_passes: unknown;
      minutes: unknown;
      goals: unknown;
      assists: unknown;
    }>
  >();
  for (const row of data) {
    const s = String(row.season ?? "");
    if (!bySeason.has(s)) bySeason.set(s, []);
    bySeason.get(s)!.push(row);
  }

  let bestSeason = "";
  let bestCount = 0;
  for (const [season, rows] of bySeason) {
    if (rows.length > bestCount) {
      bestCount = rows.length;
      bestSeason = season;
    }
  }
  if (!bestSeason) return null;

  const rows = bySeason.get(bestSeason)!;
  let xg = 0;
  let xa = 0;
  let shots = 0;
  let key_passes = 0;
  let minutes = 0;
  let goals = 0;
  let assists = 0;
  for (const r of rows) {
    xg += Number(r.xg) || 0;
    xa += Number(r.xa) || 0;
    shots += Number(r.shots) || 0;
    key_passes += Number(r.key_passes) || 0;
    minutes += Number(r.minutes) || 0;
    goals += Number(r.goals) || 0;
    assists += Number(r.assists) || 0;
  }

  return {
    season: bestSeason,
    matches: rows.length,
    minutes,
    xg,
    xa,
    shots,
    key_passes,
    goals,
    assists,
  };
}

export type PlayerProfileBundle = PlayerHubPayload & {
  radar: PlayerRadarAxes;
  understat: UnderstatSeasonAggregate | null;
};

export async function loadPlayerProfileBundle(
  fplId: number,
  horizon: number,
): Promise<PlayerProfileBundle | null> {
  const base = await loadPlayerHubData(fplId, horizon);
  if (!base) return null;

  const pos = base.static.position ?? "MID";
  const [understat, peerP95] = await Promise.all([
    loadUnderstatSeasonAggregate(fplId),
    loadPeerP95ForPosition(pos),
  ]);

  return {
    ...base,
    radar: buildPlayerRadarAxes(base.static, peerP95),
    understat,
  };
}
