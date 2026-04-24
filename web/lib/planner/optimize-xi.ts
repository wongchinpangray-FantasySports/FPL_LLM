import type { PlannerPickPayload } from "@/components/planner/types";
import { validateXiFormation } from "./validate";

/**
 * Try every C(15,11) = 1365 starting XIs and return the 11 fpl_ids with
 * maximum sum of projected xP subject to FPL formation rules.
 */
export function findBestXiByXp(
  picks: PlannerPickPayload[],
  xpByFid: Record<string, number>,
): number[] | null {
  if (picks.length !== 15) return null;

  const sorted = [...picks].sort((a, b) => a.slot - b.slot);
  let bestSum = -Infinity;
  let best: number[] | null = null;

  function dfs(start: number, chosen: PlannerPickPayload[]) {
    if (chosen.length === 11) {
      if (validateXiFormation(chosen).length > 0) return;
      const sum = chosen.reduce(
        (s, p) => s + (xpByFid[String(p.fpl_id)] ?? 0),
        0,
      );
      if (sum > bestSum) {
        bestSum = sum;
        best = chosen.map((p) => p.fpl_id);
      }
      return;
    }
    const need = 11 - chosen.length;
    for (let i = start; i <= 15 - need; i++) {
      dfs(i + 1, [...chosen, sorted[i]]);
    }
  }

  dfs(0, []);
  return best;
}
