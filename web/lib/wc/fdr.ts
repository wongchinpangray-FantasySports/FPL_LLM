import type { WcTeam } from "@/lib/wc/types";

const HOME_BASE = 1.35;
const AWAY_BASE = 1.05;
const LEAGUE_AVG = 1.2;

/**
 * Project FDR 1–5 for attackers (1 = easiest) from team strength ratings.
 * Uses expected goals FOR the player's team vs opponent defence.
 */
export function projectWcFdr(
  team: WcTeam,
  opponent: WcTeam,
  home: boolean,
): number {
  const base = home ? HOME_BASE : AWAY_BASE;
  const lambdaFor =
    (team.attack_strength / 50) *
    (opponent.defence_strength / 50) *
    base *
    LEAGUE_AVG;

  if (lambdaFor >= 2.0) return 1;
  if (lambdaFor >= 1.65) return 2;
  if (lambdaFor >= 1.35) return 3;
  if (lambdaFor >= 1.05) return 4;
  return 5;
}

export function fdrClass(fdr: number): string {
  if (fdr <= 2) return "bg-emerald-500/30 border-emerald-400/40";
  if (fdr === 3) return "bg-amber-500/25 border-amber-400/40";
  if (fdr === 4) return "bg-orange-500/30 border-orange-400/40";
  return "bg-rose-600/40 border-rose-400/50";
}
