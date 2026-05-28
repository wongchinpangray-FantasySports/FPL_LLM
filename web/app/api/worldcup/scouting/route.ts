import { NextResponse } from "next/server";
import { buildWcScouting } from "@/lib/wc/data";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureWcSeeded();
    const report = await buildWcScouting();
    return NextResponse.json({
      ...report,
      disclaimer:
        "Gem scores blend projected group-stage xP, FIFA % selected, and price. Excludes Premier League club players (FPL-linked) and spotlight clubs (Real Madrid, Barcelona, Bayern, PSG).",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load scouting report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
