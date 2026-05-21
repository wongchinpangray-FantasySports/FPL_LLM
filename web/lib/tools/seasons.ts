import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import type { ToolHandler } from "./types";

const listFplSeasons: ToolHandler = {
  name: "list_fpl_seasons",
  description:
    "List FPL campaign years present in the database (from fixtures and per-GW player stats). Use this before passing `fpl_season` on other tools for multi-year or historical analysis. The `active_season` field is what the site uses for **live** next-GW / transfer / captain advice when `fpl_season` is omitted.",
  input_schema: {
    type: "object",
    properties: {},
  },
  async run() {
    const supa = getServerSupabase();
    const { data, error } = await supa.from("fpl_seasons_list").select("season");
    if (error) throw new Error(error.message);
    const seasons = [
      ...new Set(
        (data ?? [])
          .map((r) => (r.season != null ? String(r.season).trim() : ""))
          .filter(Boolean),
      ),
    ].sort((a, b) => Number(b) - Number(a));
    const active_season = await getCurrentFplSeason();
    return {
      seasons,
      active_season,
      note: "Omit `fpl_season` on compare_players, get_fixtures, get_player_recent_gameweeks, and get_fdr to use `active_season` (current game). Pass `fpl_season` (e.g. \"2024\") only for historical deep dives — player roster/prices in players_static are always the current season.",
    };
  },
};

export const seasonTools: ToolHandler[] = [listFplSeasons];
