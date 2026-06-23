import type { TeamStrength } from "@/lib/xp";

const HOME_ATTACK = 1.45;
const AWAY_ATTACK = 1.15;
const STRENGTH_BASELINE = 1100;

/** Higher = easier attacking fixture for the player's team. */
export function projectFplAttackEase(
  team: TeamStrength,
  opponent: TeamStrength,
  home: boolean,
): number {
  const base = home ? HOME_ATTACK : AWAY_ATTACK;
  const atk = home ? team.attack_home : team.attack_away;
  const def = home ? opponent.defence_away : opponent.defence_home;
  return base * (atk / STRENGTH_BASELINE) * (STRENGTH_BASELINE / def);
}

/** Map attack-ease scores to FDR 1–5 using quintiles (1 = easiest). */
export function buildFplFdrLookup(
  teams: Map<number, TeamStrength>,
  fixtures: {
    id: number;
    home_team_id: number;
    away_team_id: number;
  }[],
): Map<string, number> {
  type Cell = { key: string; ease: number };
  const cells: Cell[] = [];

  for (const fx of fixtures) {
    const home = teams.get(fx.home_team_id);
    const away = teams.get(fx.away_team_id);
    if (!home || !away) continue;

    cells.push({
      key: `${fx.home_team_id}:${fx.id}`,
      ease: projectFplAttackEase(home, away, true),
    });
    cells.push({
      key: `${fx.away_team_id}:${fx.id}`,
      ease: projectFplAttackEase(away, home, false),
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

export function lookupFplFdr(
  lookup: Map<string, number>,
  teamId: number,
  fixtureId: number,
  fallback = 3,
): number {
  return lookup.get(`${teamId}:${fixtureId}`) ?? fallback;
}

export function fdrClass(fdr: number | null): string {
  if (fdr === null) return "bg-muted";
  if (fdr <= 2) return "bg-emerald-500/30 border-emerald-400/40";
  if (fdr === 3) return "bg-amber-500/25 border-amber-400/40";
  if (fdr === 4) return "bg-orange-500/30 border-orange-400/40";
  return "bg-rose-600/40 border-rose-400/50";
}
