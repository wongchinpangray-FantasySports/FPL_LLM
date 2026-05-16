import type { PlannerPickPayload } from "@/components/planner/types";
import { countByTeam, validateXiFormation } from "./validate";

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

/**
 * Best legal XI from a larger pool (e.g. ~22 players) for a **single** xP map
 * (usually next-GW xP). Objective = FPL score with optimal captain on the
 * highest-xP starter: `sum(xp) + max(xp)` (equivalent to doubling the armband pick).
 * Respects max 3 per club. Complexity C(n,11); keep n ≤ ~22 for server latency.
 */
export function findBestStartingElevenFromPool(
  pool: PlannerPickPayload[],
  xpByFid: Record<string, number>,
): { xi: PlannerPickPayload[]; score: number } | null {
  if (pool.length < 11) return null;
  const sorted = [...pool].sort((a, b) => a.slot - b.slot || a.fpl_id - b.fpl_id);
  let bestScore = -Infinity;
  let best: PlannerPickPayload[] | null = null;

  function teamOk(chosen: PlannerPickPayload[]): boolean {
    for (const n of countByTeam(chosen).values()) {
      if (n > 3) return false;
    }
    return true;
  }

  function dfs(start: number, chosen: PlannerPickPayload[]) {
    if (chosen.length === 11) {
      if (!teamOk(chosen)) return;
      if (validateXiFormation(chosen).length > 0) return;
      const xs = chosen.map((p) => xpByFid[String(p.fpl_id)] ?? 0);
      const sum = xs.reduce((a, b) => a + b, 0);
      const mx = Math.max(...xs);
      const score = sum + mx;
      if (score > bestScore) {
        bestScore = score;
        best = [...chosen];
      }
      return;
    }
    const need = 11 - chosen.length;
    for (let i = start; i <= sorted.length - need; i++) {
      const next = sorted[i];
      const trial = [...chosen, next];
      if (!teamOk(trial)) continue;
      dfs(i + 1, trial);
    }
  }

  dfs(0, []);
  if (best == null) return null;
  return { xi: best, score: bestScore };
}
