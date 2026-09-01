import type { NextFixtureOpponent } from "@/lib/xp";

/** e.g. `COV (H)` for pitch cards and browse sidebar. */
export function formatMiniNextFixture(
  n: NextFixtureOpponent | null | undefined,
): string | null {
  if (!n?.opp_short) return null;
  return `${n.opp_short} (${n.home ? "H" : "A"})`;
}
