import { NextResponse } from "next/server";
import { buildWcScouting } from "@/lib/wc/data";
import { ensureWcSeeded } from "@/lib/wc/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureWcSeeded();
    const { report, projection } = await buildWcScouting();
    return NextResponse.json({
      ...report,
      projection,
      disclaimer:
        "Gem scores blend projected remaining group xP, FIFA % selected, and price. Tournament stats from FIFA fantasy when available. Excludes Premier League club players (FPL-linked) and spotlight clubs (Real Madrid, Barcelona, Bayern, PSG).",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to load scouting report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
