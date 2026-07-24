import { resolveCurrentGw } from "@/lib/xp";

export const SQUAD_BUILDER_FROM_GW = 1;

export type SquadBuilderWindow = {
  currentGw: number;
  fromGw: number;
  toGw: number;
  horizon: number;
};

/** Squad Builder always plans from GW1 across a selectable horizon. */
export async function resolveSquadBuilderWindow(
  horizonInput: number,
): Promise<SquadBuilderWindow> {
  const { current } = await resolveCurrentGw();
  const horizon = Math.min(8, Math.max(1, Math.floor(horizonInput) || 5));
  const fromGw = SQUAD_BUILDER_FROM_GW;
  const toGw = fromGw + horizon - 1;
  return { currentGw: current, fromGw, toGw, horizon };
}
