import { NextResponse } from "next/server";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import { fetchFifaRounds } from "@/lib/wc/fifa-rounds";
import { buildKnockoutBracket } from "@/lib/wc/knockout-bracket";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const [{ matches }, fifaRounds] = await Promise.all([
      buildWcMatchesWithStats(),
      fetchFifaRounds(),
    ]);

    const byId = new Map(matches.map((m) => [m.id, m]));
    const bracket = buildKnockoutBracket(fifaRounds, byId, locale);

    return NextResponse.json({
      bracket,
      disclaimer: "Knockout path from FIFA fantasy schedule; later rounds fill as results land.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load bracket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
