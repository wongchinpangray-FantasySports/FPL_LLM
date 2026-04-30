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
  "defensive_contribution",
  "defensive_contribution_per_90",
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
  defensive_contribution: number | null;
  defensive_contribution_per_90: number | null;
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

/** Six 0–100 scores vs same-position peers (p95 scale). */
export type PlayerRadarAxes = {
  form: number;
  goals_per_90: number;
  assists_per_90: number;
  defcon_per_90: number;
  xg_per_90: number;
  xa_per_90: number;
};

const RADAR_KEYS = [
  "form",
  "goals_per_90",
  "assists_per_90",
  "defcon_per_90",
  "xg_per_90",
  "xa_per_90",
] as const;

type RadarMetricKey = (typeof RADAR_KEYS)[number];

const PEER_RADAR_SELECT =
  "form,goals_scored,assists,minutes,expected_goals,expected_assists,defensive_contribution,defensive_contribution_per_90";

function per90Count(
  n: number | null | undefined,
  mins: number | null | undefined,
): number {
  const m = Math.max(1, Math.floor(Number(mins)) || 0);
  const v = Math.max(0, Number(n) || 0);
  return (v / m) * 90;
}

function defconPer90(row: {
  defensive_contribution_per_90: number | null;
  defensive_contribution: number | null;
  minutes: number | null;
}): number {
  const direct = Number(row.defensive_contribution_per_90);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  return per90Count(row.defensive_contribution, row.minutes);
}

/** Raw radar metrics before p95 scaling (same keys as `PlayerRadarAxes`). */
export function radarRawMetrics(row: PlayerHubStatic): Record<RadarMetricKey, number> {
  return {
    form: Math.max(0, Number(row.form) || 0),
    goals_per_90: per90Count(row.goals_scored, row.minutes),
    assists_per_90: per90Count(row.assists, row.minutes),
    defcon_per_90: defconPer90(row),
    xg_per_90: per90Count(row.expected_goals, row.minutes),
    xa_per_90: per90Count(row.expected_assists, row.minutes),
  };
}

function p95FromSorted(sorted: number[]): number {
  if (sorted.length === 0) return 1;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return Math.max(sorted[i]!, 1e-6);
}

export async function loadPeerP95ForPosition(
  position: string,
): Promise<Record<RadarMetricKey, number>> {
  const pos = ["GKP", "DEF", "MID", "FWD"].includes(position) ? position : "MID";
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(PEER_RADAR_SELECT)
    .eq("position", pos)
    .gt("minutes", 0);

  const out: Record<RadarMetricKey, number> = {
    form: 1,
    goals_per_90: 1,
    assists_per_90: 1,
    defcon_per_90: 1,
    xg_per_90: 1,
    xa_per_90: 1,
  };
  if (error || !data?.length) return out;

  for (const key of RADAR_KEYS) {
    const vals = data
      .map((r) => radarRawMetrics(r as unknown as PlayerHubStatic)[key])
      .filter((n) => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    out[key] = p95FromSorted(vals);
  }
  return out;
}

export function buildPlayerRadarAxes(
  row: PlayerHubStatic,
  peerP95: Record<RadarMetricKey, number>,
): PlayerRadarAxes {
  const raw = radarRawMetrics(row);
  const pct = (v: number, key: RadarMetricKey) => {
    const cap = peerP95[key] ?? 1;
    return Math.min(100, Math.round((v / cap) * 100));
  };
  return {
    form: pct(raw.form, "form"),
    goals_per_90: pct(raw.goals_per_90, "goals_per_90"),
    assists_per_90: pct(raw.assists_per_90, "assists_per_90"),
    defcon_per_90: pct(raw.defcon_per_90, "defcon_per_90"),
    xg_per_90: pct(raw.xg_per_90, "xg_per_90"),
    xa_per_90: pct(raw.xa_per_90, "xa_per_90"),
  };
}

export type PlayerProfileBundle = PlayerHubPayload & {
  radar: PlayerRadarAxes;
};

export async function loadPlayerProfileBundle(
  fplId: number,
  horizon: number,
): Promise<PlayerProfileBundle | null> {
  const base = await loadPlayerHubData(fplId, horizon);
  if (!base) return null;

  const pos = base.static.position ?? "MID";
  const peerP95 = await loadPeerP95ForPosition(pos);

  return {
    ...base,
    radar: buildPlayerRadarAxes(base.static, peerP95),
  };
}

/** Static row + radar only (no xP) — for compare overlay API. */
export async function loadPlayerRadarSnapshot(fplId: number): Promise<{
  fpl_id: number;
  label: string;
  team: string | null;
  position: string | null;
  radar: PlayerRadarAxes;
} | null> {
  if (!Number.isFinite(fplId) || fplId <= 0) return null;

  const supa = getServerSupabase();
  const { data: row, error } = await supa
    .from("players_static")
    .select(PLAYER_HUB_STATIC_COLS)
    .eq("fpl_id", fplId)
    .maybeSingle();

  if (error || !row) return null;

  const staticRow = row as unknown as PlayerHubStatic;
  const pos = staticRow.position ?? "MID";
  const peerP95 = await loadPeerP95ForPosition(pos);
  const radar = buildPlayerRadarAxes(staticRow, peerP95);
  const label =
    staticRow.web_name ?? staticRow.name ?? `#${staticRow.fpl_id}`;

  return {
    fpl_id: staticRow.fpl_id,
    label,
    team: staticRow.team,
    position: staticRow.position,
    radar,
  };
}
