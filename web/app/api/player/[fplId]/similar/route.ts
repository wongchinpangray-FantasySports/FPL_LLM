import { NextResponse } from "next/server";
import { loadSimilarRadarPeers } from "@/lib/player-hub";

export async function GET(
  _req: Request,
  { params }: { params: { fplId: string } },
) {
  const fplId = Number(params.fplId);
  if (!Number.isFinite(fplId) || fplId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const peers = await loadSimilarRadarPeers(fplId);
  return NextResponse.json({ peers });
}
