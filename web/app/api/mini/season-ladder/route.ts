import { NextResponse } from "next/server";
import { buildSeasonLadder } from "@/lib/mini/season-ladder";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await buildSeasonLadder({ limit: 50 });
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load season ladder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
