import { NextResponse } from "next/server";
import { requireAuthForApi } from "@/lib/auth/require-auth-api";
import {
  buildRecommendedSquadPack,
  loadExcludeChipPlayers,
  parseRecommendedConstraints,
} from "@/lib/fpl/recommended-squad";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Popular exclude chips for the recommended-squad UI. */
export async function GET() {
  const access = await requireAuthForApi();
  if (access instanceof NextResponse) return access;

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
  const access = await requireAuthForApi();
  if (access instanceof NextResponse) return access;

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
