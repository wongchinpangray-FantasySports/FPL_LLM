import { NextResponse } from "next/server";
import { loadSwapRecommendations } from "@/lib/planner/swap-recommendations";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      position?: string;
      excludeIds?: number[];
      horizon?: number;
    };
    const position = String(body.position ?? "").trim().toUpperCase();
    if (!["GKP", "DEF", "MID", "FWD"].includes(position)) {
      return NextResponse.json(
        { error: "position must be GKP, DEF, MID, or FWD" },
        { status: 400 },
      );
    }
    const data = await loadSwapRecommendations({
      position,
      excludeIds: Array.isArray(body.excludeIds) ? body.excludeIds : [],
      horizon: Number(body.horizon) > 0 ? Number(body.horizon) : 5,
    });
    return NextResponse.json(data);
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Swap recommendations failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
