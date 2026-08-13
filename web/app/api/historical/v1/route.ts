import {
  HISTORICAL_API_VERSION,
  PUBLIC_CACHE,
  enforceHistoricalRateLimit,
  historicalJson,
} from "@/lib/historical/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historical API contract discovery (public).
 *
 *   GET /api/historical/v1
 */
export async function GET(req: Request) {
  const limited = await enforceHistoricalRateLimit(req, {
    bucket: "root",
    limit: 60,
    window: "1 m",
  });
  if (limited) return limited;

  return historicalJson(
    {
      ok: true,
      version: HISTORICAL_API_VERSION,
      auth: {
        public: ["GET /api/historical/v1", "GET /api/historical/v1/meta", "GET /api/historical/v1/suggest"],
        bearer: ["GET /api/historical/v1/stats", "GET /api/historical/v1/player"],
        header: "Authorization: Bearer <HISTORICAL_API_KEY>",
      },
      notes: [
        "player_id / fpl_id is season-scoped (same id can map to different players across seasons).",
        "Prefer filtering by season + web_name / playerKey; do not assume cross-season identity.",
        "Data sourced from Fantasy Premier League + vaastav/Fantasy-Premier-League backfill — attribution required.",
      ],
      docs: "https://www.faleague-ai.com/docs/historical-api",
    },
    { cacheControl: PUBLIC_CACHE },
  );
}
