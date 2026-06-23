import { NextResponse } from "next/server";
import { getWcMiniMatchdayContext } from "@/lib/wc-mini/matchday";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getWcMiniMatchdayContext();
    return NextResponse.json(ctx);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
