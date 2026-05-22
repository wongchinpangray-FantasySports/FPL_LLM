import { resolveCurrentGw } from "@/lib/xp";

export type PlannerProjectionWindow = {
  currentGw: number;
  fromGw: number;
  toGw: number;
  horizon: number;
};

/**
 * Same GW window as `/api/planner/project`: upcoming GWs from `current + 1`
 * unless `fromGw` is passed explicitly.
 */
export async function resolvePlannerProjectionWindow(
  horizonInput: number,
  fromGwOverride?: number,
): Promise<PlannerProjectionWindow> {
  const { current } = await resolveCurrentGw();
  const horizon = Math.min(8, Math.max(1, Math.floor(horizonInput) || 5));
  const fromGw =
    fromGwOverride != null && fromGwOverride > 0
      ? Math.floor(fromGwOverride)
      : current + 1;
  const toGw = fromGw + horizon - 1;
  return { currentGw: current, fromGw, toGw, horizon };
}
