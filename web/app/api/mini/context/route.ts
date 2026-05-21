import { NextResponse } from "next/server";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMiniGameweekContext();
    return NextResponse.json(ctx);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
