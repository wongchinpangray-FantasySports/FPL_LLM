import { NextResponse } from "next/server";
import { loadPlayerRadarSnapshot } from "@/lib/player-hub";

export async function GET(
  _req: Request,
  { params }: { params: { fplId: string } },
) {
  const fplId = Number(params.fplId);
  if (!Number.isFinite(fplId) || fplId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const snap = await loadPlayerRadarSnapshot(fplId);
  if (!snap) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    fpl_id: snap.fpl_id,
    label: snap.label,
    team: snap.team,
    position: snap.position,
    radar: snap.radar,
  });
}
