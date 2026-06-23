import { NextResponse } from "next/server";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { NewsCategory, WcNewsRegion } from "@/lib/wc/news-feeds";

export const dynamic = "force-dynamic";

const REGIONS = new Set<WcNewsRegion>([
  "US",
  "UK",
  "EU",
  "LATAM",
  "APAC",
  "GLOBAL",
]);

const CATEGORIES = new Set<NewsCategory>([
  "trending",
  "transfer",
  "epl",
  "worldcup",
  "leagues",
  "events",
]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const region = url.searchParams.get("region")?.toUpperCase() ?? "ALL";
    const categoryParam = url.searchParams.get("category")?.toLowerCase() ?? "trending";
    const category = CATEGORIES.has(categoryParam as NewsCategory)
      ? (categoryParam as NewsCategory)
      : "trending";
    const editorialOnly = url.searchParams.get("editorial") === "1";
    const refresh = url.searchParams.get("refresh") === "1";
    const limit = Math.min(
      120,
      Math.max(10, Number(url.searchParams.get("limit") ?? "60")),
    );

    const { items, cached, fetched_at, source } = await getWcNewsForApi({
      limit: 150,
      editorialOnly,
      refresh,
      category,
    });

    let filtered = items;
    if (region !== "ALL" && REGIONS.has(region as WcNewsRegion)) {
      filtered = items.filter((i) => i.region === region);
    }

    return NextResponse.json(
      {
        items: filtered.slice(0, limit),
        total: filtered.length,
        region,
        category,
        editorial_only: editorialOnly,
        cached,
        fetched_at,
        source,
        disclaimer:
          "Headlines from third-party RSS feeds. Open links to read full articles on publisher sites.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load news";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
