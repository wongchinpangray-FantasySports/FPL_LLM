import { NextResponse } from "next/server";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roundFilter = url.searchParams.get("round");

    const { rounds, matches } = await buildWcMatchesWithStats();
    let filtered = matches;
    if (roundFilter && roundFilter !== "ALL") {
      const rid = Number(roundFilter);
      if (Number.isFinite(rid)) {
        filtered = matches.filter((m) => m.round_id === rid);
      }
    }

    return NextResponse.json({
      rounds,
      matches: filtered,
      disclaimer:
        "Schedule and scores from FIFA. Goal/card minutes from API-Football when configured.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
