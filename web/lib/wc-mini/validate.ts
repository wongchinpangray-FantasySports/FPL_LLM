export interface WcMiniPickInput {
  player_id: number;
  position: string | null;
  wc_team_id: number | null;
}

export interface WcMiniValidationIssue {
  code: string;
  message: string;
}

const MAX_PER_POSITION = { GKP: 1, DEF: 2, MID: 2, FWD: 2 } as const;

export function countWcMiniByPosition(
  picks: WcMiniPickInput[],
): Record<keyof typeof MAX_PER_POSITION, number> {
  const c = { GKP: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of picks) {
    const pos = p.position;
    if (pos && pos in c) c[pos as keyof typeof c] += 1;
  }
  return c;
}

export function validateWcPartialSquad(
  picks: WcMiniPickInput[],
): WcMiniValidationIssue[] {
  const issues: WcMiniValidationIssue[] = [];
  if (picks.length > 5) {
    issues.push({ code: "size", message: "Squad cannot have more than 5 players." });
    return issues;
  }

  const ids = picks.map((p) => p.player_id);
  if (new Set(ids).size !== ids.length) {
    issues.push({ code: "duplicate", message: "Each player can only be picked once." });
  }

  const byPos = countWcMiniByPosition(picks);
  if (byPos.GKP > 1) {
    issues.push({ code: "gkp", message: "Only one goalkeeper allowed." });
  }
  for (const pos of ["DEF", "MID", "FWD"] as const) {
    if (byPos[pos] > MAX_PER_POSITION[pos]) {
      issues.push({
        code: `pos_${pos}`,
        message: `At most ${MAX_PER_POSITION[pos]} ${pos} (have ${byPos[pos]}).`,
      });
    }
  }

  const byTeam = new Map<number, number>();
  for (const p of picks) {
    if (p.wc_team_id == null) continue;
    byTeam.set(p.wc_team_id, (byTeam.get(p.wc_team_id) ?? 0) + 1);
  }
  for (const [tid, n] of byTeam) {
    if (n > 2) {
      issues.push({
        code: "nation_cap",
        message: `Max 2 players per national team (team ${tid}: ${n}).`,
      });
    }
  }

  return issues;
}

export function validateWcMiniSquad(picks: WcMiniPickInput[]): WcMiniValidationIssue[] {
  const issues: WcMiniValidationIssue[] = [];
  if (picks.length !== 5) {
    issues.push({
      code: "size",
      message: `Need exactly 5 players (have ${picks.length}).`,
    });
    return issues;
  }

  issues.push(...validateWcPartialSquad(picks));

  const byPos = countWcMiniByPosition(picks);
  if (byPos.GKP !== 1) {
    issues.push({
      code: "gkp",
      message: `Need exactly 1 goalkeeper (have ${byPos.GKP}).`,
    });
  }
  const outfield = byPos.DEF + byPos.MID + byPos.FWD;
  if (outfield !== 4) {
    issues.push({
      code: "outfield",
      message: `Need 4 outfield players (have ${outfield}).`,
    });
  }

  return issues;
}

export function validateWcCaptaincy(
  picks: WcMiniPickInput[],
  captainId: number,
  viceId: number,
): WcMiniValidationIssue[] {
  const issues: WcMiniValidationIssue[] = [];
  const ids = new Set(picks.map((p) => p.player_id));
  if (!ids.has(captainId)) {
    issues.push({ code: "captain", message: "Captain must be in your squad." });
  }
  if (!ids.has(viceId)) {
    issues.push({ code: "vice", message: "Vice-captain must be in your squad." });
  }
  if (captainId === viceId) {
    issues.push({
      code: "captain_vice_same",
      message: "Captain and vice-captain must be different players.",
    });
  }
  return issues;
}
