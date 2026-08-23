import { NextResponse } from "next/server";
import { buildBadgesLadder } from "@/lib/mini/badge-events";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildBadgesLadder({ limit: 50 });
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load badges leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
