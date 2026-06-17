import { NextResponse } from "next/server";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { WcNewsRegion } from "@/lib/wc/news-feeds";

export const dynamic = "force-dynamic";

const REGIONS = new Set<WcNewsRegion>([
  "US",
  "UK",
  "EU",
  "LATAM",
  "APAC",
  "GLOBAL",
]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.toUpperCase() ?? "ALL";
    const editorialOnly = url.searchParams.get("editorial") === "1";
    const refresh = url.searchParams.get("refresh") === "1";
    const limit = Math.min(
      120,
      Math.max(10, Number(url.searchParams.get("limit") ?? "80")),
    );

    const { items, cached, fetched_at, source } = await getWcNewsForApi({
      limit: 150,
      editorialOnly,
      refresh,
    });

    let filtered = items;
    if (region !== "ALL" && REGIONS.has(region as WcNewsRegion)) {
      filtered = items.filter((i) => i.region === region);
    }

    return NextResponse.json({
      items: filtered.slice(0, limit),
      total: filtered.length,
      region,
      editorial_only: editorialOnly,
      cached,
      fetched_at,
      source,
      disclaimer:
        "Headlines and links from third-party RSS feeds (Google News and publishers). We do not host article text; open links for full editorials.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
