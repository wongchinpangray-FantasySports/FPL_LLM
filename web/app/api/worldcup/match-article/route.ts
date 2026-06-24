import { NextResponse } from "next/server";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import {
  canWriteMatchArticle,
  getOrCreateMatchArticle,
} from "@/lib/wc/match-article";
import { displayTeamName } from "@/lib/wc/team-names-zh";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const matchId = Number(url.searchParams.get("matchId") ?? "0");
    const locale = url.searchParams.get("locale") ?? "en";

    if (!Number.isFinite(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    const { matches } = await buildWcMatchesWithStats();
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!canWriteMatchArticle(match)) {
      return NextResponse.json(
        { error: "Article not available for this match yet" },
        { status: 400 },
      );
    }

    const article = await getOrCreateMatchArticle(match, locale, matches);
    return NextResponse.json({
      match_id: matchId,
      home: displayTeamName(match.home_code, match.home_name, locale),
      away: displayTeamName(match.away_code, match.away_name, locale),
      home_code: match.home_code,
      away_code: match.away_code,
      score:
        match.home_score != null && match.away_score != null
          ? `${match.home_score}-${match.away_score}`
          : null,
      kickoff: match.kickoff,
      round_label: match.round_label,
      venue: match.venue,
      ...article,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load match article";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
