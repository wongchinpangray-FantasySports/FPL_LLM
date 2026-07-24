import type { PlannerPickPayload } from "@/components/planner/types";
import { isFilledPick, slotPosition } from "@/lib/squad-builder/slots";

/** Prefer the next empty slot for the player’s position; fall back to selected slot. */
export function targetSlotForPlayer(
  picks: PlannerPickPayload[],
  player: { position: string | null },
  selectedSlot: number | null,
): number | null {
  const pos = player.position;
  const emptyForPos = picks.find(
    (row) =>
      !isFilledPick(row) && (pos == null || row.position === pos || slotPosition(row.slot) === pos),
  );
  if (emptyForPos) return emptyForPos.slot;

  if (selectedSlot != null) {
    const row = picks.find((p) => p.slot === selectedSlot);
    const need = slotPosition(selectedSlot);
    if (row && (pos == null || need === pos || row.position === pos)) {
      return selectedSlot;
    }
  }

  const anyEmpty = picks.find((p) => !isFilledPick(p));
  return anyEmpty?.slot ?? null;
}
