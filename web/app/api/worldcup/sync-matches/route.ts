import { NextResponse } from "next/server";
import { syncWcMatchStats } from "@/lib/wc/match-stats-store";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

/** Refresh FIFA schedule and scores in Supabase cache. */
export async function POST() {
  try {
    await ensureWcSeeded();
    const result = await syncWcMatchStats();
    return NextResponse.json({
      ...result,
      hint: "FIFA schedule/scores plus goal & card minutes from API-Football when API_FOOTBALL_KEY is set.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Match sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
