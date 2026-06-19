import { NextResponse } from "next/server";
import { loadWcTablesData } from "@/lib/wc/standings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadWcTablesData();
    return NextResponse.json({
      ...data,
      disclaimer:
        "Group tables and leaderboards from live FIFA match results (scores and goal scorers). Squad lists from the World Cup fantasy pool.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tables";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
