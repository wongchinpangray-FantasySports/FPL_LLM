/** FPL-style captain / vice-captain multipliers on official GW total_points. */

import {
  MINI_DIFF_CAPTAIN_BONUS,
  isDifferentialPick,
} from "@/lib/mini/incentives";

export interface GwStatRow {
  player_id: number;
  total_points: number | null;
  minutes: number | null;
}

export interface MiniScoreBreakdown {
  player_id: number;
  base_points: number;
  /** Extra points from captain / vice doubling (0 or equals base for doubled player). */
  captain_bonus: number;
  scored_points: number;
}

export interface MiniSquadScore {
  total: number;
  breakdown: MiniScoreBreakdown[];
  doubled_player_id: number | null;
  /** +N when the doubled player is a Mini/FPL differential. */
  differential_bonus: number;
  differential_captain: boolean;
}

export interface MiniScoreOwnershipOpts {
  miniOwnedById?: Record<number, number>;
  /** FPL ownership fallback keyed by player id (from stored picks / static). */
  fplOwnedById?: Record<number, number>;
  miniEntries?: number;
}

/**
 * FPL: captain scores double if they play (>0 minutes). If captain plays 0,
 * vice-captain doubles instead (if they play). If both play 0, no double.
 * Differential captain: +MINI_DIFF_CAPTAIN_BONUS when the doubled player is low-owned.
 */
export function scoreMiniSquad(
  pickIds: number[],
  captainFplId: number,
  viceFplId: number,
  statsByPlayer: Map<number, GwStatRow>,
  ownership?: MiniScoreOwnershipOpts,
): MiniSquadScore {
  const breakdown: MiniScoreBreakdown[] = [];
  let total = 0;

  for (const id of pickIds) {
    const row = statsByPlayer.get(id);
    const base = Math.max(0, row?.total_points ?? 0);
    breakdown.push({
      player_id: id,
      base_points: base,
      captain_bonus: 0,
      scored_points: base,
    });
    total += base;
  }

  const capMins = statsByPlayer.get(captainFplId)?.minutes ?? 0;
  const viceMins = statsByPlayer.get(viceFplId)?.minutes ?? 0;
  let doubledId: number | null = null;
  if (capMins > 0) doubledId = captainFplId;
  else if (viceMins > 0) doubledId = viceFplId;

  if (doubledId != null) {
    const line = breakdown.find((b) => b.player_id === doubledId);
    if (line) {
      line.captain_bonus = line.base_points;
      line.scored_points = line.base_points * 2;
      total += line.base_points;
    }
  }

  let differentialBonus = 0;
  let differentialCaptain = false;
  if (doubledId != null && ownership) {
    const miniEntries = ownership.miniEntries ?? 0;
    const diff = isDifferentialPick({
      miniOwnedPct: ownership.miniOwnedById?.[doubledId] ?? null,
      fplOwnedPct: ownership.fplOwnedById?.[doubledId] ?? null,
      miniEntries,
    });
    if (diff) {
      differentialCaptain = true;
      differentialBonus = MINI_DIFF_CAPTAIN_BONUS;
      total += differentialBonus;
    }
  }

  return {
    total,
    breakdown,
    doubled_player_id: doubledId,
    differential_bonus: differentialBonus,
    differential_captain: differentialCaptain,
  };
}
