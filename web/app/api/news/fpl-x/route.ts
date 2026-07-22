import { NextResponse } from "next/server";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { FplXTopic } from "@/lib/fpl/fpl-x-feed";
import {
  filterFplXItems,
  filterFplXThisWeek,
  sortFplXItems,
} from "@/lib/fpl/fpl-x-feed";

export const dynamic = "force-dynamic";

const TOPICS = new Set<FplXTopic>(["all", "injury", "lineup", "transfer"]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const topicParam = url.searchParams.get("topic")?.toLowerCase() ?? "all";
    const topic = TOPICS.has(topicParam as FplXTopic)
      ? (topicParam as FplXTopic)
      : "all";
    const refresh =
      url.searchParams.get("refresh") === "1" &&
      process.env.NODE_ENV !== "production";
    const weekOnly = url.searchParams.get("week") !== "all";
    const limit = Math.min(
      50,
      Math.max(5, Number(url.searchParams.get("limit") ?? "40")),
    );

    const { items, cached, fetched_at, source } = await getWcNewsForApi({
      limit: 150,
      editorialOnly: false,
      refresh,
      category: "ALL",
    });

    let fplItems = items.filter((i) => i.feed_id === "fpl-x");
    if (weekOnly) {
      fplItems = filterFplXThisWeek(fplItems, { fallbackToAll: true });
    }
    fplItems = filterFplXItems(fplItems, topic);
    fplItems = sortFplXItems(fplItems).slice(0, limit);

    return NextResponse.json(
      {
        items: fplItems,
        total: fplItems.length,
        topic,
        cached,
        fetched_at,
        source,
        week_only: weekOnly,
        disclaimer:
          "Posts from @FantasyPremierLeague and curated FPL accounts on X. Open links to read on x.com.",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load FPL posts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
