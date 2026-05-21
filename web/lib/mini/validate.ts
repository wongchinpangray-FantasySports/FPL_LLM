/** Mini fantasy squad rules: 5 picks, 1 GKP, max 2 per outfield position, max 2 per club. */

export interface MiniPickInput {
  fpl_id: number;
  position: string | null;
  team_id: number | null;
}

export interface MiniValidationIssue {
  code: string;
  message: string;
}

const MAX_PER_POSITION = { GKP: 1, DEF: 2, MID: 2, FWD: 2 } as const;

export function countMiniByPosition(
  picks: MiniPickInput[],
): Record<keyof typeof MAX_PER_POSITION, number> {
  const c = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of picks) {
    const pos = p.position;
    if (pos && pos in c) c[pos as keyof typeof c] += 1;
  }
  return c;
}

export function validateMiniSquad(picks: MiniPickInput[]): MiniValidationIssue[] {
  const issues: MiniValidationIssue[] = [];

  if (picks.length !== 5) {
    issues.push({
      code: "size",
      message: `Need exactly 5 players (have ${picks.length}).`,
    });
    return issues;
  }

  const ids = picks.map((p) => p.fpl_id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ code: "duplicate", message: "Each player can only be picked once." });
  }

  const byPos = countMiniByPosition(picks);
  if (byPos.GKP !== 1) {
    issues.push({
      code: "gkp",
      message: `Need exactly 1 goalkeeper (have ${byPos.GKP}).`,
    });
  }

  for (const pos of ["DEF", "MID", "FWD"] as const) {
    if (byPos[pos] > MAX_PER_POSITION[pos]) {
      issues.push({
        code: `pos_${pos}`,
        message: `At most ${MAX_PER_POSITION[pos]} ${pos} (have ${byPos[pos]}).`,
      });
    }
  }

  const outfield = byPos.DEF + byPos.MID + byPos.FWD;
  if (outfield !== 4) {
    issues.push({
      code: "outfield",
      message: `Need 4 outfield players (have ${outfield}).`,
    });
  }

  const byTeam = new Map<number, number>();
  for (const p of picks) {
    if (p.team_id == null) continue;
    byTeam.set(p.team_id, (byTeam.get(p.team_id) ?? 0) + 1);
  }
  for (const [tid, n] of byTeam) {
    if (n > 2) {
      issues.push({
        code: "club_cap",
        message: `Max 2 players per club (team ${tid}: ${n}).`,
      });
    }
  }

  for (const p of picks) {
    if (!p.position || !(p.position in MAX_PER_POSITION)) {
      issues.push({
        code: "invalid_position",
        message: `Invalid position for player ${p.fpl_id}.`,
      });
    }
  }

  return issues;
}

export function validateCaptaincy(
  picks: MiniPickInput[],
  captainFplId: number,
  viceFplId: number,
): MiniValidationIssue[] {
  const issues: MiniValidationIssue[] = [];
  const ids = new Set(picks.map((p) => p.fpl_id));

  if (!ids.has(captainFplId)) {
    issues.push({ code: "captain", message: "Captain must be in your squad." });
  }
  if (!ids.has(viceFplId)) {
    issues.push({ code: "vice", message: "Vice-captain must be in your squad." });
  }
  if (captainFplId === viceFplId) {
    issues.push({
      code: "captain_vice_same",
      message: "Captain and vice-captain must be different players.",
    });
  }
  return issues;
}
