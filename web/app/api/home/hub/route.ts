import { NextResponse } from "next/server";
import { withCloudflareEdgeCache } from "@/lib/cf-edge-cache";
import { EMPTY_HOME_HUB, loadHomeHubDataLiteCached } from "@/lib/home/hub-data";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";

const CACHEABLE = {
  "Cache-Control": "public, max-age=90, s-maxage=90, stale-while-revalidate=180",
};

export async function GET(req: Request) {
  return withCloudflareEdgeCache(req, async () => {
    try {
      const locale = readLocaleFromRequest(req);
      const data = await loadHomeHubDataLiteCached(locale);
      return NextResponse.json(data, { headers: CACHEABLE });
    } catch {
      // Empty 200 — a 5xx retry storm from the homepage was 1102'ing the isolate.
      return NextResponse.json(EMPTY_HOME_HUB, {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=15, s-maxage=15, stale-while-revalidate=60",
        },
      });
    }
  });
}
