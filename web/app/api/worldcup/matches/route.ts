import { NextResponse } from "next/server";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import {
  localizeWcMatches,
  readLocaleFromRequest,
} from "@/lib/wc/localize-players";
import { sortWcMatchesForDisplay } from "@/lib/wc/fifa-rounds";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
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

    const localized = await localizeWcMatches(filtered, locale);

    return NextResponse.json({
      rounds,
      matches: sortWcMatchesForDisplay(localized),
      disclaimer:
        "Schedule and scores from FIFA. Goal/card minutes from API-Football when configured.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load matches";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
