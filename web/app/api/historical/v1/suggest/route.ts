import {
  HISTORICAL_SEASON_ALL,
  isHistoricalAllSeasons,
  searchHistoricalPlayerSuggestions,
  type HistoricalPosition,
} from "@/lib/fpl/historical-data";
import { minPlayerQueryLength } from "@/lib/fpl/player-search";
import {
  PUBLIC_CACHE,
  enforceHistoricalRateLimit,
  historicalJson,
} from "@/lib/historical/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public player name suggestions (light autocomplete).
 *
 *   GET /api/historical/v1/suggest?q=haaland&season=2024
 */
export async function GET(req: Request) {
  const limited = await enforceHistoricalRateLimit(req, {
    bucket: "suggest",
    limit: 60,
    window: "1 m",
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") ?? "";
  const q = searchParams.get("q")?.trim() ?? "";
  const seasonRaw = searchParams.get("season")?.trim();
  const season =
    seasonRaw?.toUpperCase() === HISTORICAL_SEASON_ALL
      ? HISTORICAL_SEASON_ALL
      : seasonRaw || undefined;
  const positionRaw = searchParams.get("position")?.trim();
  const position =
    positionRaw &&
    (["GKP", "DEF", "MID", "FWD"] as const).includes(
      positionRaw as HistoricalPosition,
    )
      ? (positionRaw as HistoricalPosition)
      : undefined;
  const teamRaw = searchParams.get("teamId");
  const teamId =
    teamRaw != null && Number.isFinite(Number(teamRaw))
      ? Math.floor(Number(teamRaw))
      : undefined;
  const limitRaw = searchParams.get("limit");

  if (q.length < minPlayerQueryLength(q)) {
    return historicalJson(
      { suggestions: [] },
      { cacheControl: PUBLIC_CACHE },
    );
  }

  try {
    const suggestions = await searchHistoricalPlayerSuggestions({
      q,
      locale,
      season: isHistoricalAllSeasons(season) ? undefined : season,
      position,
      teamId,
      limit:
        limitRaw != null && Number.isFinite(Number(limitRaw))
          ? Math.min(Math.max(Math.floor(Number(limitRaw)), 1), 25)
          : 12,
    });
    return historicalJson(
      { suggestions },
      { cacheControl: PUBLIC_CACHE },
    );
  } catch (e) {
    return historicalJson(
      {
        error: e instanceof Error ? e.message : "Suggestion query failed",
      },
      { status: 500, cacheControl: "no-store" },
    );
  }
}
