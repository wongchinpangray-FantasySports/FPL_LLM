import { NextResponse } from "next/server";
import {
  buildRecommendedSquadPack,
  loadExcludeChipPlayers,
  parseRecommendedConstraints,
} from "@/lib/fpl/recommended-squad";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Popular exclude chips for the recommended-squad UI. */
export async function GET() {
  try {
    const players = await loadExcludeChipPlayers(12);
    return NextResponse.json({ players });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load players";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** One-shot generation: constraints → 3 contrastive squads. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const constraints = parseRecommendedConstraints(body);
    const pack = await buildRecommendedSquadPack(constraints);
    return NextResponse.json(pack);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build squads";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
