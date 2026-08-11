import { NextResponse } from "next/server";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { missionForGw, MINI_DIFF_CAPTAIN_BONUS, MINI_DIFF_OWN_PCT } from "@/lib/mini/incentives";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await getMiniGameweekContext();
    const gw = ctx.submission_gw ?? ctx.scoring_gw;
    const mission = missionForGw(gw);
    return NextResponse.json({
      ...ctx,
      mission: {
        gw,
        id: mission.id,
        titleKey: mission.titleKey,
        bodyKey: mission.bodyKey,
      },
      incentives: {
        diff_own_pct: MINI_DIFF_OWN_PCT,
        diff_captain_bonus: MINI_DIFF_CAPTAIN_BONUS,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load context";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
