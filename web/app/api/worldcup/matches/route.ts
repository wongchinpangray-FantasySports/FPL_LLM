import { NextResponse } from "next/server";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";
import { isApiFootballConfigured } from "@/lib/wc/api-football-stats";
import {
  buildWcMatchesWithStats,
  fetchAndCacheMatchStats,
} from "@/lib/wc/match-stats-store";

export const dynamic = "force-dynamic";

function findMatch(matches: WcMatchRow[], id: number): WcMatchRow | null {
  return matches.find((m) => m.id === id) ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tournamentId = Number(url.searchParams.get("statsFor") ?? "0");
    const roundFilter = url.searchParams.get("round");

    const { rounds, matches, stats_provider } = await buildWcMatchesWithStats();
    let filtered = matches;
    if (roundFilter && roundFilter !== "ALL") {
      const rid = Number(roundFilter);
      if (Number.isFinite(rid)) {
        filtered = matches.filter((m) => m.round_id === rid);
      }
    }

    let statsFor: WcMatchRow | null = null;
    if (Number.isFinite(tournamentId) && tournamentId > 0) {
      const base = findMatch(matches, tournamentId);
      if (base) {
        statsFor =
          base.stats_available && base.home_stats && base.away_stats
            ? base
            : await fetchAndCacheMatchStats(base);
      }
    }

    const provider =
      stats_provider === "cache"
        ? "cache"
        : isApiFootballConfigured()
          ? "api-football"
          : null;

    return NextResponse.json({
      rounds,
      matches: filtered,
      stats_for: statsFor,
      stats_provider: provider,
      disclaimer:
        "Match schedule and scores from FIFA fantasy feeds. Advanced team stats (xG, possession, shots) use API-Football when API_FOOTBALL_KEY is set — Opta is FIFA's official data partner; this app does not carry a commercial Opta license.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
