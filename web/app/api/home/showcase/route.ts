import { NextResponse } from "next/server";
import { getShowcaseRecommendedSquad } from "@/lib/planner/showcase-recommended-squad";

/**
 * Do not prerender at `next build`: CI (e.g. Cloudflare) often has no Supabase
 * env vars during the build image, and this handler would throw on
 * `getServerSupabase()`. Freshness comes from `Cache-Control` + in-function
 * `unstable_cache` (see `getShowcaseRecommendedSquad`).
 */
export const dynamic = "force-dynamic";

/**
 * Public JSON for the home “Best XI” block. Heavy CPU work is isolated from the
 * home document request (important on Cloudflare Workers CPU limits). Responses
 * are cacheable at the edge so most hits never re-run the optimizer.
 */
export async function GET() {
  const data = await getShowcaseRecommendedSquad();
  const cache =
    data == null
      ? "public, s-maxage=120, stale-while-revalidate=600"
      : "public, s-maxage=600, stale-while-revalidate=86400";

  return NextResponse.json(data, {
    headers: { "Cache-Control": cache },
  });
}
