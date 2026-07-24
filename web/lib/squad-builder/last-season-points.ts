import { loadVaastavSeasonTotalsByCode } from "@/lib/fpl/historical-vaastav";
import { listAvailableFplSeasons } from "@/lib/fpl/historical-data";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getServerSupabase } from "@/lib/supabase";

const CHUNK = 200;

/** Most recent FPL season key before the current campaign (e.g. `2025` for 25/26). */
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

async function sumGwStatsForPlayers(
  season: string,
  playerIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (playerIds.length === 0) return out;

  const supa = getServerSupabase();
  for (let i = 0; i < playerIds.length; i += CHUNK) {
    const chunk = playerIds.slice(i, i + CHUNK);
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

  return out;
}

/**
 * Last completed season totals for sidebar browse rows.
 * Uses stable FPL element `code` → vaastav season totals (handles id remaps each year).
 */
export async function loadLastSeasonPointsForPlayers(
  fplIds: number[],
  codeByFplId?: Map<number, number>,
): Promise<{ season: string | null; points: Map<number, number> }> {
  const out = new Map<number, number>();
  if (fplIds.length === 0) return { season: null, points: out };

  const season = await resolveLastCompletedSeasonKey();
  if (!season) return { season: null, points: out };

  const vaastavByCode = await loadVaastavSeasonTotalsByCode(season);
  const unresolved: number[] = [];

  for (const id of fplIds) {
    const code = codeByFplId?.get(id);
    if (code != null && vaastavByCode.has(code)) {
      out.set(id, vaastavByCode.get(code)!);
      continue;
    }
    unresolved.push(id);
  }

  if (unresolved.length > 0) {
    const gwTotals = await sumGwStatsForPlayers(season, unresolved);
    for (const id of unresolved) {
      const pts = gwTotals.get(id);
      if (pts != null) out.set(id, pts);
    }
  }

  return { season, points: out };
}
