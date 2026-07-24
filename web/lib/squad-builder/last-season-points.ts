import { listAvailableFplSeasons } from "@/lib/fpl/historical-data";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getServerSupabase } from "@/lib/supabase";

const CHUNK = 200;

/** Most recent FPL season key before the current campaign (e.g. `2024` for 24/25). */
export async function resolveLastCompletedSeasonKey(): Promise<string | null> {
  const current = Number(await getCurrentFplSeason());
  if (!Number.isFinite(current)) return null;

  const seasons = await listAvailableFplSeasons();
  const candidates = seasons
    .map((s) => Number(s))
    .filter((y) => Number.isFinite(y) && y < current)
    .sort((a, b) => b - a);

  if (candidates.length > 0) return String(candidates[0]);

  const fallback = String(current - 1);
  return Number.isFinite(Number(fallback)) ? fallback : null;
}

export async function loadLastSeasonPointsForPlayers(
  fplIds: number[],
): Promise<{ season: string | null; points: Map<number, number> }> {
  const out = new Map<number, number>();
  if (fplIds.length === 0) return { season: null, points: out };

  const season = await resolveLastCompletedSeasonKey();
  if (!season) return { season: null, points: out };

  const supa = getServerSupabase();
  for (let i = 0; i < fplIds.length; i += CHUNK) {
    const chunk = fplIds.slice(i, i + CHUNK);
    const { data, error } = await supa
      .from("player_gw_stats")
      .select("player_id,total_points")
      .eq("season", season)
      .in("player_id", chunk);

    if (error) continue;

    for (const row of data ?? []) {
      const id = Number(row.player_id);
      if (!Number.isFinite(id)) continue;
      out.set(id, (out.get(id) ?? 0) + Number(row.total_points ?? 0));
    }
  }

  return { season, points: out };
}
