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
  return scoreMiniSquadFiltered(
    pickIds,
    captainFplId,
    viceFplId,
    statsByPlayer,
    null,
    ownership,
  );
}

/**
 * Score a squad, optionally limiting to picks whose `team_id` is in `allowedTeamIds`.
 * Used for “yesterday’s matchday” partial totals during a live GW.
 */
export function scoreMiniSquadFiltered(
  pickIds: number[],
  captainFplId: number,
  viceFplId: number,
  statsByPlayer: Map<number, GwStatRow>,
  allowedTeamIds: Set<number> | null,
  ownership?: MiniScoreOwnershipOpts,
  pickTeamById?: Map<number, number | null>,
): MiniSquadScore {
  const eligibleIds =
    allowedTeamIds == null
      ? pickIds
      : pickIds.filter((id) => {
          const teamId = pickTeamById?.get(id);
          return teamId != null && allowedTeamIds.has(teamId);
        });

  if (eligibleIds.length === 0) {
    return {
      total: 0,
      breakdown: pickIds.map((id) => ({
        player_id: id,
        base_points: 0,
        captain_bonus: 0,
        scored_points: 0,
      })),
      doubled_player_id: null,
      differential_bonus: 0,
      differential_captain: false,
    };
  }

  const capEligible = eligibleIds.includes(captainFplId);
  const viceEligible = eligibleIds.includes(viceFplId);
  const effectiveCaptain = capEligible
    ? captainFplId
    : viceEligible
      ? viceFplId
      : captainFplId;
  const effectiveVice = capEligible ? viceFplId : captainFplId;

  const breakdown: MiniScoreBreakdown[] = [];
  let total = 0;

  for (const id of eligibleIds) {
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

  const capMins = statsByPlayer.get(effectiveCaptain)?.minutes ?? 0;
  const viceMins = statsByPlayer.get(effectiveVice)?.minutes ?? 0;
  let doubledId: number | null = null;
  if (capEligible && capMins > 0) doubledId = effectiveCaptain;
  else if (viceEligible && viceMins > 0) doubledId = effectiveVice;

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
