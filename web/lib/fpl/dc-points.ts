/**
 * FPL defensive-contribution points for one match (capped at 2).
 * DEF: 10+ CBIT; MID/FWD: 12+ CBIRT. GKP are not eligible.
 */
export function fplDcPoints(
  position: string | null | undefined,
  defensiveContribution: number,
): number {
  const pos = String(position ?? "")
    .trim()
    .toUpperCase();
  if (!pos || pos === "GKP" || pos === "GK") return 0;
  const threshold = pos === "DEF" ? 10 : 12;
  return defensiveContribution >= threshold ? 2 : 0;
}
