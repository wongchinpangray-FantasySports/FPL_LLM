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

export const SQUAD_BUILDER_BUDGET_M = 100.0;

export function isFilledPick(p: PlannerPickPayload): boolean {
  return p.fpl_id > 0;
}

export function filledPicks(picks: PlannerPickPayload[]): PlannerPickPayload[] {
  return picks.filter(isFilledPick);
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
    is_starter: i < 11,
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
