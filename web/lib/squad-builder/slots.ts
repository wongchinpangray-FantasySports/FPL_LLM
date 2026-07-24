import type { PlannerPickPayload } from "@/components/planner/types";

/** FPL slot order: 2 GKP, 5 DEF, 5 MID, 3 FWD. */
const SLOT_POSITIONS = [
  "GKP",
  "GKP",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "DEF",
  "MID",
  "MID",
  "MID",
  "MID",
  "MID",
  "FWD",
  "FWD",
  "FWD",
] as const;

/** Default XI: 3-4-3 — 1 GKP, 3 DEF, 4 MID, 3 FWD. Bench: 1 GKP, 2 DEF, 1 MID. */
export const DEFAULT_STARTER_SLOTS = new Set([
  1, 3, 4, 5, 8, 9, 10, 11, 13, 14, 15,
]);

export const SQUAD_BUILDER_BUDGET_M = 100.0;

export function isFilledPick(p: PlannerPickPayload): boolean {
  return p.fpl_id > 0;
}

export function filledPicks(picks: PlannerPickPayload[]): PlannerPickPayload[] {
  return picks.filter(isFilledPick);
}

export function normalizeEmptySquadFormation(
  picks: PlannerPickPayload[],
): PlannerPickPayload[] {
  if (filledPicks(picks).length > 0) return picks;
  return picks.map((p) => ({
    ...p,
    is_starter: DEFAULT_STARTER_SLOTS.has(p.slot),
  }));
}

export function createEmptySquad(): PlannerPickPayload[] {
  return SLOT_POSITIONS.map((position, i) => ({
    slot: i + 1,
    fpl_id: 0,
    web_name: null,
    team: null,
    team_id: null,
    position,
    base_price: null,
    is_starter: DEFAULT_STARTER_SLOTS.has(i + 1),
    is_captain: false,
    is_vice_captain: false,
  }));
}

export function squadSpendM(picks: PlannerPickPayload[]): number {
  return filledPicks(picks).reduce((s, p) => s + (p.base_price ?? 0), 0);
}

export function squadBankM(picks: PlannerPickPayload[]): number {
  return Math.round((SQUAD_BUILDER_BUDGET_M - squadSpendM(picks)) * 10) / 10;
}

export function slotPosition(slot: number): string | null {
  return SLOT_POSITIONS[slot - 1] ?? null;
}
