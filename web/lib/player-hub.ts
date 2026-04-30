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
