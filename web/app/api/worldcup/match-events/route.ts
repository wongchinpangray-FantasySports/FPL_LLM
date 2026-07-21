import { NextResponse } from "next/server";
import { buildWcMatchSchedule } from "@/lib/wc/fifa-rounds";
import { loadWcMatchesForDisplay } from "@/lib/wc/match-stats-store";
import { isCacheOnlyDataRuntime } from "@/lib/worker-runtime";

export const dynamic = "force-dynamic";

/** Goal/card timeline for a finished match (cached; API-Football only outside Workers). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const matchId = Number(url.searchParams.get("matchId") ?? "0");
    if (!Number.isFinite(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    const matches = await loadWcMatchesForDisplay();
    let match = matches.find((m) => m.id === matchId);
    if (!match) {
      const { matches: schedule } = await buildWcMatchSchedule().catch(() => ({
        matches: [] as typeof matches,
      }));
      match = schedule.find((m) => m.id === matchId);
    }
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json({
      match,
      source: isCacheOnlyDataRuntime() ? "cache" : "fifa",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load match events";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
