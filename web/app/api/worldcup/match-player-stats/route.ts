import { NextResponse } from "next/server";
import {
  fetchPlayerMatchStats,
  isApiFootballConfigured,
} from "@/lib/wc/api-football-stats";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const matchId = Number(url.searchParams.get("matchId") ?? "0");
    const player = url.searchParams.get("player")?.trim() ?? "";

    if (!Number.isFinite(matchId) || matchId <= 0 || !player) {
      return NextResponse.json(
        { error: "Missing matchId or player" },
        { status: 400 },
      );
    }

    const { matches } = await buildWcMatchesWithStats();
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!isApiFootballConfigured()) {
      return NextResponse.json({
        stats: null,
        configured: false,
        player,
        match_id: matchId,
      });
    }

    const stats = await fetchPlayerMatchStats(match, player);
    return NextResponse.json({
      stats,
      configured: true,
      player,
      match_id: matchId,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load player match stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
