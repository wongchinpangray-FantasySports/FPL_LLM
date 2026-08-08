import { NextResponse } from "next/server";
import { loadPlayerShotMapCached } from "@/lib/fpl/understat-shots";

export const dynamic = "force-dynamic";

/** Public shot-map payload (Understat x/y + xG). */
export async function GET(
  req: Request,
  { params }: { params: { fplId: string } },
) {
  const fplId = Number(params.fplId);
  if (!Number.isFinite(fplId) || fplId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const season = new URL(req.url).searchParams.get("season")?.trim() || undefined;

  try {
    const data = await loadPlayerShotMapCached(fplId, season);
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load shots";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
