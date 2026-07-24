import type { PlannerPickPayload } from "@/components/planner/types";
import { isFilledPick } from "@/lib/squad-builder/slots";

export type SquadGwXpt = {
  gw: number;
  xpt: number;
};

type ProjRow = {
  by_gw?: { gw: number; xp: number }[];
};

/** Sum projected starter xPts per GW (captain earns double). */
export function computeSquadGwXpt(
  picks: PlannerPickPayload[],
  projById: Record<string, ProjRow>,
  captainId: number | null,
  fromGw: number,
  toGw: number,
): SquadGwXpt[] {
  const starters = picks.filter((p) => p.is_starter && isFilledPick(p));
  const out: SquadGwXpt[] = [];

  for (let gw = fromGw; gw <= toGw; gw++) {
    let total = 0;
    for (const p of starters) {
      const strip = projById[String(p.fpl_id)]?.by_gw ?? [];
      const cell = strip.find((c) => c.gw === gw);
      const base = cell?.xp ?? 0;
      const mult =
        captainId != null && p.fpl_id === captainId ? 2 : 1;
      total += base * mult;
    }
    out.push({ gw, xpt: Math.round(total * 10) / 10 });
  }

  return out;
}

export function horizonTotalXpt(rows: SquadGwXpt[]): number {
  return Math.round(rows.reduce((s, r) => s + r.xpt, 0) * 10) / 10;
}

/** Single-GW squad xPt for tab summaries (returns null if any starter lacks projection). */
export function computeSingleGwSquadXpt(
  picks: PlannerPickPayload[],
  projById: Record<string, ProjRow>,
  captainId: number | null,
  gw: number,
): number | null {
  const starters = picks.filter((p) => p.is_starter && isFilledPick(p));
  if (starters.length !== 11) return null;
  let total = 0;
  for (const p of starters) {
    const strip = projById[String(p.fpl_id)]?.by_gw ?? [];
    const cell = strip.find((c) => c.gw === gw);
    if (cell?.xp == null || !Number.isFinite(cell.xp)) return null;
    const mult = captainId != null && p.fpl_id === captainId ? 2 : 1;
    total += cell.xp * mult;
  }
  return Math.round(total * 10) / 10;
}
