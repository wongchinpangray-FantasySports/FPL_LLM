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
      hint: "Schedule and scores from FIFA rounds.json. Run daily during the tournament.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Match sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
