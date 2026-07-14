import { NextResponse } from "next/server";
import { requireAuthForApi } from "@/lib/auth/require-auth-api";
import {
  HISTORICAL_SEASON_ALL,
  isHistoricalAllSeasons,
  searchHistoricalPlayerSuggestions,
  type HistoricalPosition,
} from "@/lib/fpl/historical-data";

export async function GET(req: Request) {
  const access = await requireAuthForApi();
  if (access instanceof NextResponse) return access;

  const { searchParams } = new URL(req.url);
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

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const suggestions = await searchHistoricalPlayerSuggestions({
      q,
      season: isHistoricalAllSeasons(season) ? undefined : season,
      position,
      teamId,
      limit:
        limitRaw != null && Number.isFinite(Number(limitRaw))
          ? Math.floor(Number(limitRaw))
          : 12,
    });
    return NextResponse.json({ suggestions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Suggestion query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
