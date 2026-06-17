import { NextResponse } from "next/server";
import { buildWcMatchSchedule } from "@/lib/wc/fifa-rounds";
import {
  buildWcMatchesWithStats,
  fetchAndCacheMatchEvents,
} from "@/lib/wc/match-stats-store";

export const dynamic = "force-dynamic";

/** On-demand goal/card timeline for a finished match (API-Football + cache). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const matchId = Number(url.searchParams.get("matchId") ?? "0");
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    const { matches } = await buildWcMatchesWithStats();
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      const { matches: schedule } = await buildWcMatchSchedule();
      const fallback = schedule.find((m) => m.id === matchId);
      if (!fallback) {
        return NextResponse.json({ error: "Match not found" }, { status: 404 });
      }
      const enriched = await fetchAndCacheMatchEvents(fallback);
      return NextResponse.json({
        match: enriched ?? fallback,
        source: enriched ? "api-football" : "fifa",
      });
    }

    const goals = [...match.home_goals, ...match.away_goals];
    const cards = [...match.home_cards, ...match.away_cards];
    const hasTimeline =
      goals.some((g) => g.minute) || cards.length > 0;

    if (hasTimeline) {
      return NextResponse.json({ match, source: "cache" });
    }

    const enriched = await fetchAndCacheMatchEvents(match);
    return NextResponse.json({
      match: enriched ?? match,
      source: enriched ? "api-football" : "fifa",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load match events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
