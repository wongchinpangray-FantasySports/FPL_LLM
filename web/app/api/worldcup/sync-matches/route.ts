import { NextResponse } from "next/server";
import { syncWcMatchStats } from "@/lib/wc/match-stats-store";
import { isApiFootballConfigured } from "@/lib/wc/api-football-stats";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

/** Refresh FIFA schedule in DB and pull team stats for finished matches (batch). */
export async function POST(req: Request) {
  try {
    await ensureWcSeeded();
    const url = new URL(req.url);
    const requested = Number(url.searchParams.get("limit") ?? "8");
    const limit = Math.min(
      12,
      Math.max(0, Number.isFinite(requested) ? requested : 8),
    );

    const result = await syncWcMatchStats({ statsLimit: limit });
    return NextResponse.json({
      ...result,
      api_football_configured: isApiFootballConfigured(),
      hint: "Schedule from FIFA rounds.json. Repeat POST after kickoff to enrich more finished matches, or set a daily cron to this URL.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Match sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
