import { NextResponse, type NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { buildChrisScorecard } from "@/lib/scout/scorecard";
import {
  loadScoutTrialStats,
  monthWindow,
  previousMonthWindow,
  trialWindow,
} from "@/lib/scout/stats";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const range = req.nextUrl.searchParams.get("range") ?? "month";
    const window =
      range === "previous"
        ? previousMonthWindow()
        : range === "trial"
          ? trialWindow()
          : monthWindow();
    const stats = await loadScoutTrialStats(window);
    return NextResponse.json({
      stats,
      scorecard: buildChrisScorecard(stats),
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to load stats";
    return NextResponse.json({ error: message }, { status });
  }
}
