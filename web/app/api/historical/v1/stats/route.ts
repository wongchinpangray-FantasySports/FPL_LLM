import {
  parseHistoricalQueryParams,
  queryHistoricalStats,
} from "@/lib/fpl/historical-data";
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
 * Partner historical stats query (Bearer required).
 *
 *   GET /api/historical/v1/stats?season=2024&position=FWD&sortBy=total_points
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
    bucket: "stats",
    limit: 120,
    window: "1 m",
  });
  if (limited) return limited;

  try {
    const { searchParams } = new URL(req.url);
    const params = parseHistoricalQueryParams(searchParams);
    // Partner cap: keep aggregates bounded (UI allows up to 200).
    params.limit = Math.min(params.limit ?? 50, 100);
    const result = await queryHistoricalStats(params);
    return historicalJson(result, { cacheControl: PRIVATE_CACHE });
  } catch (e) {
    return historicalJson(
      { error: e instanceof Error ? e.message : "Query failed" },
      { status: 500, cacheControl: "no-store" },
    );
  }
}
