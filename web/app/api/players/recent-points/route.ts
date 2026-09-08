import { NextResponse } from "next/server";
import { loadRecentGwPointsByPlayerIds } from "@/lib/player-gw-history";

/** Batch last-N GW points for pitch sparklines: `?ids=1,2,3&limit=3`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const idsRaw = url.searchParams.get("ids") ?? "";
  const limit = Number(url.searchParams.get("limit") || 3);
  const ids = idsRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!ids.length) {
    return NextResponse.json({ points: {} });
  }

  const map = await loadRecentGwPointsByPlayerIds(ids, limit);
  const points: Record<string, number[]> = {};
  for (const [id, pts] of map) {
    points[String(id)] = pts;
  }
  return NextResponse.json({ points });
}
