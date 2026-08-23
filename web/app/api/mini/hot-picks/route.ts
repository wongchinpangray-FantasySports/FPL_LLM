import { NextResponse } from "next/server";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { getMiniHotPicks } from "@/lib/mini/hot-picks";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ctx = await getMiniGameweekContext();
    const gwParam = searchParams.get("gw");
    const gw =
      gwParam != null && gwParam !== ""
        ? Number(gwParam)
        : ctx.scoring_gw;
    if (!Number.isInteger(gw) || gw < 1) {
      return NextResponse.json({ error: "Invalid gw" }, { status: 400 });
    }
    const data = await getMiniHotPicks(gw, 12);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load hot picks";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
