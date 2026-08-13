import { loadHistoricalMeta } from "@/lib/fpl/historical-data";
import {
  PUBLIC_CACHE,
  enforceHistoricalRateLimit,
  historicalJson,
} from "@/lib/historical/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public historical meta (seasons, teams, GW bounds).
 *
 *   GET /api/historical/v1/meta
 */
export async function GET(req: Request) {
  const limited = await enforceHistoricalRateLimit(req, {
    bucket: "meta",
    limit: 60,
    window: "1 m",
  });
  if (limited) return limited;

  try {
    const meta = await loadHistoricalMeta();
    return historicalJson(meta, { cacheControl: PUBLIC_CACHE });
  } catch (e) {
    return historicalJson(
      { error: e instanceof Error ? e.message : "Failed to load meta" },
      { status: 500, cacheControl: "no-store" },
    );
  }
}
