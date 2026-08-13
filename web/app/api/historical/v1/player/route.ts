import { loadHistoricalPlayerDetail } from "@/lib/fpl/historical-data";
import { authorizeHistoricalRequest } from "@/lib/historical/auth";
import {
  PRIVATE_CACHE,
  enforceHistoricalRateLimit,
  historicalJson,
} from "@/lib/historical/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Partner historical player detail (Bearer required).
 *
 *   GET /api/historical/v1/player?playerId=355&season=2024&gwFrom=1&gwTo=10
 *   Authorization: Bearer <HISTORICAL_API_KEY>
 */
export async function GET(req: Request) {
  const auth = authorizeHistoricalRequest(req);
  if (!auth.ok) {
    return historicalJson(
      { error: auth.error },
      { status: auth.status, cacheControl: "no-store" },
    );
  }

  const limited = await enforceHistoricalRateLimit(req, {
    bucket: "player",
    limit: 120,
    window: "1 m",
  });
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const playerId = Number(searchParams.get("playerId"));
  const season = searchParams.get("season") ?? undefined;
  const gwFrom = searchParams.get("gwFrom");
  const gwTo = searchParams.get("gwTo");

  if (!Number.isFinite(playerId) || playerId <= 0) {
    return historicalJson(
      { error: "Invalid playerId" },
      { status: 400, cacheControl: "no-store" },
    );
  }

  try {
    const rosterHint =
      searchParams.get("webName") ||
      searchParams.get("name") ||
      searchParams.get("team")
        ? {
            web_name: searchParams.get("webName") ?? undefined,
            name: searchParams.get("name") ?? undefined,
            team: searchParams.get("team") ?? undefined,
            position: searchParams.get("position") ?? undefined,
          }
        : undefined;

    const detail = await loadHistoricalPlayerDetail(
      Math.floor(playerId),
      season,
      gwFrom != null ? Number(gwFrom) : undefined,
      gwTo != null ? Number(gwTo) : undefined,
      rosterHint,
    );
    if (!detail) {
      return historicalJson(
        { error: "Player not found" },
        { status: 404, cacheControl: "no-store" },
      );
    }
    return historicalJson(detail, { cacheControl: PRIVATE_CACHE });
  } catch (e) {
    return historicalJson(
      { error: e instanceof Error ? e.message : "Failed to load player" },
      { status: 500, cacheControl: "no-store" },
    );
  }
}
