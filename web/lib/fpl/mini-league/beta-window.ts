/** Inclusive FPL gameweek window for Mini League Killer beta trials. */

export const MINI_LEAGUE_BETA_DURATION_EVENTS = 5;
export const MINI_LEAGUE_BETA_RECOMMENDED_TESTERS = 8;
export const MINI_LEAGUE_BETA_TESTER_MIN = 6;
export const MINI_LEAGUE_BETA_TESTER_MAX = 10;

export function clampBetaDuration(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return MINI_LEAGUE_BETA_DURATION_EVENTS;
  return Math.min(38, Math.max(1, Math.round(n)));
}

/** Last GW of a trial that starts at `startEvent` and lasts `durationEvents` (inclusive). */
export function trialEndEvent(
  startEvent: number,
  durationEvents = MINI_LEAGUE_BETA_DURATION_EVENTS,
): number {
  return startEvent + clampBetaDuration(durationEvents) - 1;
}

/** GWs still in the window, including the current GW. 0 once the trial has ended. */
export function remainingTrialEvents(
  currentGw: number,
  endEvent: number | null | undefined,
): number | null {
  if (endEvent == null || !Number.isFinite(endEvent)) return null;
  return Math.max(0, endEvent - currentGw + 1);
}

export function isTrialExpired(
  currentGw: number,
  endEvent: number | null | undefined,
): boolean {
  if (endEvent == null || !Number.isFinite(endEvent)) return false;
  return currentGw > endEvent;
}
