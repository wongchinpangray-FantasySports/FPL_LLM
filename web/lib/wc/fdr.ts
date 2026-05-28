import type { WcTeam } from "@/lib/wc/types";

const HOME_ATTACK = 1.38;
const AWAY_ATTACK = 1.02;

/** Higher = easier attacking fixture for the player's team. */
export function projectWcAttackEase(
  team: WcTeam,
  opponent: WcTeam,
  home: boolean,
): number {
  const base = home ? HOME_ATTACK : AWAY_ATTACK;
  return (
    (team.attack_strength / opponent.defence_strength) *
    base *
    Math.pow(team.attack_strength / 55, 0.35)
  );
}

/** Map attack-ease scores to FDR 1–5 using group-stage quintiles (1 = easiest). */
export function buildWcFdrLookup(
  teams: Map<number, WcTeam>,
  fixtures: {
    home_team_id: number;
    away_team_id: number;
    matchday: number;
  }[],
): Map<string, number> {
  type Cell = { key: string; ease: number };
  const cells: Cell[] = [];

  for (const fx of fixtures) {
    const home = teams.get(fx.home_team_id);
    const away = teams.get(fx.away_team_id);
    if (!home || !away) continue;

    cells.push({
      key: `${fx.home_team_id}:${fx.matchday}`,
      ease: projectWcAttackEase(home, away, true),
    });
    cells.push({
      key: `${fx.away_team_id}:${fx.matchday}`,
      ease: projectWcAttackEase(away, home, false),
    });
  }

  const sorted = [...cells].sort((a, b) => b.ease - a.ease);
  const n = sorted.length;
  const out = new Map<string, number>();

  sorted.forEach((cell, idx) => {
    const pct = n <= 1 ? 0 : idx / (n - 1);
    let fdr: number;
    if (pct <= 0.2) fdr = 1;
    else if (pct <= 0.4) fdr = 2;
    else if (pct <= 0.6) fdr = 3;
    else if (pct <= 0.8) fdr = 4;
    else fdr = 5;
    out.set(cell.key, fdr);
  });

  return out;
}

export function lookupWcFdr(
  lookup: Map<string, number>,
  teamId: number,
  matchday: number,
  fallback = 3,
): number {
  return lookup.get(`${teamId}:${matchday}`) ?? fallback;
}

export function fdrClass(fdr: number): string {
  if (fdr <= 2) return "bg-emerald-500/30 border-emerald-400/40";
  if (fdr === 3) return "bg-amber-500/25 border-amber-400/40";
  if (fdr === 4) return "bg-orange-500/30 border-orange-400/40";
  return "bg-rose-600/40 border-rose-400/50";
}

/** @deprecated Use buildWcFdrLookup + lookupWcFdr */
export function projectWcFdr(
  team: WcTeam,
  opponent: WcTeam,
  home: boolean,
): number {
  const ease = projectWcAttackEase(team, opponent, home);
  if (ease >= 2.35) return 1;
  if (ease >= 1.85) return 2;
  if (ease >= 1.45) return 3;
  if (ease >= 1.1) return 4;
  return 5;
}
