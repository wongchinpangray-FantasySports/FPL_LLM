import { fplGet } from "@/lib/fpl";

type LiveEventApi = {
  elements?: Array<{
    id: number;
    stats?: { total_points?: number };
  }>;
};

/**
 * Per-player points for a single gameweek from FPL `/event/{gw}/live/`.
 * Returns raw element points (no captain multiplier).
 */
export async function loadLiveGwPointsById(
  gw: number,
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!Number.isFinite(gw) || gw <= 0) return map;
  try {
    const live = await fplGet<LiveEventApi>(`/event/${gw}/live/`, {
      cacheBust: true,
    });
    for (const el of live.elements ?? []) {
      const id = Number(el.id);
      if (!Number.isFinite(id)) continue;
      map.set(id, Number(el.stats?.total_points) || 0);
    }
  } catch {
    // leave empty — UI shows "—"
  }
  return map;
}
