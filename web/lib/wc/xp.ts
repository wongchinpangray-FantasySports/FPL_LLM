import type { WcFixtureXp, WcPlayer, WcPlayerProjection, WcTeam } from "@/lib/wc/types";
import { lookupWcFdr } from "@/lib/wc/fdr";

function goalPts(position: string): number {
  if (position === "GKP" || position === "DEF") return 6;
  if (position === "MID") return 5;
  return 4;
}

function csPts(position: string): number {
  if (position === "GKP" || position === "DEF") return 4;
  if (position === "MID") return 1;
  return 0;
}

function per90(total: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return (total / minutes) * 90;
}

/**
 * Simplified WC fantasy xP per fixture (FALEAGUE model — not official FIFA scoring).
 */
export function projectWcPlayerFixture(
  player: WcPlayer,
  team: WcTeam,
  opponent: WcTeam,
  home: boolean,
  fixtureId: number,
  matchday: number,
  fdr: number,
): WcFixtureXp {
  const base = home ? 1.35 : 1.05;

  const lambdaFor =
    (team.attack_strength / 50) *
    (opponent.defence_strength / 50) *
    base *
    1.2;
  const lambdaAgainst =
    (opponent.attack_strength / 50) *
    (team.defence_strength / 50) *
    (home ? 1.05 : 1.35) *
    1.2;

  const mins = Math.min(90, Math.max(60, player.minutes > 0 ? 78 : 70));
  const pPlay = mins >= 60 ? 0.88 : 0.75;
  const appearance = mins >= 60 ? 2 : 1;

  const xg90 = per90(player.xg, player.minutes);
  const xa90 = per90(player.xa, player.minutes);
  const formBoost = 1 + Math.min(Math.max(player.form, 0), 10) * 0.015;

  const xgExp = (xg90 / 90) * mins * (lambdaFor / 1.2) * formBoost;
  const xaExp = (xa90 / 90) * mins * (lambdaFor / 1.2) * formBoost;

  const pGoal = Math.min(0.55, xgExp * 0.85);
  const pAssist = Math.min(0.45, xaExp * 0.7);
  const pCs =
    player.position === "FWD"
      ? 0
      : Math.exp(-lambdaAgainst) * (player.position === "MID" ? 0.35 : 0.55);

  let xp =
    appearance * pPlay +
    pGoal * goalPts(player.position) +
    pAssist * 3 +
    pCs * csPts(player.position);

  if (player.position === "GKP") {
    xp += Math.min(3, lambdaAgainst * 0.8);
  }

  return {
    fixture_id: fixtureId,
    matchday,
    opp_code: opponent.code,
    home,
    fdr,
    xp: Math.round(xp * 100) / 100,
  };
}

export function projectWcPlayers(
  players: WcPlayer[],
  teams: Map<number, WcTeam>,
  fixtures: {
    id: number;
    matchday: number;
    home_team_id: number;
    away_team_id: number;
  }[],
  fdrLookup: Map<string, number>,
): WcPlayerProjection[] {
  const out: WcPlayerProjection[] = [];

  for (const player of players) {
    const team = teams.get(player.wc_team_id);
    if (!team) continue;

    const fxs: WcFixtureXp[] = [];
    for (const fx of fixtures) {
      if (fx.home_team_id !== player.wc_team_id && fx.away_team_id !== player.wc_team_id) {
        continue;
      }
      const home = fx.home_team_id === player.wc_team_id;
      const oppId = home ? fx.away_team_id : fx.home_team_id;
      const opp = teams.get(oppId);
      if (!opp) continue;
      fxs.push(
        projectWcPlayerFixture(
          player,
          team,
          opp,
          home,
          fx.id,
          fx.matchday,
          lookupWcFdr(fdrLookup, player.wc_team_id, fx.matchday),
        ),
      );
    }

    const xp_by_matchday = new Map<number, number>();
    let xp_total = 0;
    for (const f of fxs) {
      xp_total += f.xp;
      xp_by_matchday.set(f.matchday, (xp_by_matchday.get(f.matchday) ?? 0) + f.xp);
    }

    out.push({
      player,
      fixtures: fxs,
      xp_total: Math.round(xp_total * 100) / 100,
      xp_by_matchday,
    });
  }

  return out.sort((a, b) => b.xp_total - a.xp_total);
}
