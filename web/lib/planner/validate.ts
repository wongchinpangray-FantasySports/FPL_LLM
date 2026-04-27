/** FPL squad rules for a 15-man planner squad. */

export interface PickLike {
  team_id: number | null;
  position: string | null;
}

export interface ValidationIssue {
  code: string;
  message: string;
  /** Params for UI translation (optional) */
  values?: Record<string, string | number>;
}

const NEED = { GKP: 2, DEF: 5, MID: 5, FWD: 3 } as const;

export function countByPosition(picks: PickLike[]): Record<string, number> {
  const c: Record<string, number> = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of picks) {
    const pos = p.position;
    if (pos && pos in c) c[pos] += 1;
  }
  return c;
}

export function countByTeam(picks: PickLike[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of picks) {
    if (p.team_id == null) continue;
    m.set(p.team_id, (m.get(p.team_id) ?? 0) + 1);
  }
  return m;
}

export function validatePlannerSquad(picks: PickLike[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (picks.length !== 15) {
    issues.push({
      code: "size",
      message: `Need 15 players (have ${picks.length}).`,
      values: { have: picks.length },
    });
    return issues;
  }

  const byPos = countByPosition(picks);
  for (const pos of Object.keys(NEED) as Array<keyof typeof NEED>) {
    if (byPos[pos] !== NEED[pos]) {
      issues.push({
        code: `pos_${pos}`,
        message: `${pos}: need ${NEED[pos]}, have ${byPos[pos]}.`,
        values: { pos, need: NEED[pos], have: byPos[pos] },
      });
    }
  }

  for (const [tid, n] of countByTeam(picks)) {
    if (n > 3) {
      issues.push({
        code: "club_cap",
        message: `Max 3 per club (team ${tid}: ${n}).`,
        values: { teamId: tid, n },
      });
    }
  }

  return issues;
}

/**
 * FPL starting XI: 1 GK; 3–5 DEF, 2–5 MID, 1–3 FWD; 11 players total.
 */
export function validateXiFormation(starters: PickLike[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (starters.length !== 11) {
    issues.push({
      code: "xi_size",
      message: `XI needs 11 starters (have ${starters.length}).`,
      values: { have: starters.length },
    });
    return issues;
  }

  const gk = starters.filter((p) => p.position === "GKP").length;
  const d = starters.filter((p) => p.position === "DEF").length;
  const m = starters.filter((p) => p.position === "MID").length;
  const f = starters.filter((p) => p.position === "FWD").length;

  if (gk !== 1) {
    issues.push({
      code: "xi_gk",
      message: `XI: 1 GK (${gk}).`,
      values: { gk },
    });
  }
  if (d < 3 || d > 5) {
    issues.push({
      code: "xi_def",
      message: `XI: 3–5 DEF (${d}).`,
      values: { d },
    });
  }
  if (m < 2 || m > 5) {
    issues.push({
      code: "xi_mid",
      message: `XI: 2–5 MID (${m}).`,
      values: { m },
    });
  }
  if (f < 1 || f > 3) {
    issues.push({
      code: "xi_fwd",
      message: `XI: 1–3 FWD (${f}).`,
      values: { f },
    });
  }
  if (gk + d + m + f !== 11) {
    issues.push({
      code: "xi_sum",
      message: "XI lines do not add to 11.",
    });
  }

  return issues;
}

export function swapBudget(
  bank: number,
  outPrice: number | null,
  inPrice: number | null,
): number {
  const o = outPrice ?? 0;
  const i = inPrice ?? 0;
  return roundMoney(bank + o - i);
}

export function roundMoney(n: number): number {
  return Math.round(n * 10) / 10;
}

export function canAfford(bankAfter: number): boolean {
  return bankAfter >= -0.05;
}
