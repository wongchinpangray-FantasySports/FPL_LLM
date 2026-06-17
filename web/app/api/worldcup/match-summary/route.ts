import { NextResponse } from "next/server";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import {
  canSummarizeMatch,
  getOrCreateMatchSummary,
} from "@/lib/wc/match-summary";

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

    if (!canSummarizeMatch(match)) {
      return NextResponse.json(
        { error: "Summary available after full time" },
        { status: 400 },
      );
    }

    const { summary, source } = await getOrCreateMatchSummary(
      match,
      locale,
      matches,
    );
    return NextResponse.json({
      match_id: matchId,
      summary,
      source,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load match summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
