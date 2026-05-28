import type { WcPlayer } from "@/lib/wc/types";

function hasSeasonStats(p: WcPlayer): boolean {
  return (
    p.minutes > 0 &&
    (p.xg > 0.01 || p.xa > 0.01 || p.form > 0.01 || p.goals > 0 || p.assists > 0)
  );
}

/** Price + position + FIFA % selected — used before tournament stats exist. */
export function applyProvisionalWcPriors(p: WcPlayer): WcPlayer {
  const price = Math.max(3, Number(p.price ?? 5));
  const sel = Math.max(0, Number(p.selection_pct ?? 0));
  const ownBoost = 1 + Math.min(25, sel) * 0.025;
  const att = price / 10;

  let xg = 0;
  let xa = 0;
  let form = 2 + att * 2;

  switch (p.position) {
    case "FWD":
      xg = (0.06 + att * 0.14) * ownBoost;
      xa = (0.03 + att * 0.06) * ownBoost;
      form = (3 + att * 4) * ownBoost;
      break;
    case "MID":
      xg = (0.04 + att * 0.09) * ownBoost;
      xa = (0.05 + att * 0.09) * ownBoost;
      form = (3 + att * 3) * ownBoost;
      break;
    case "DEF":
      xg = (0.015 + att * 0.03) * ownBoost;
      xa = (0.02 + att * 0.04) * ownBoost;
      form = (2 + att * 2) * ownBoost;
      break;
    case "GKP":
      xg = 0;
      xa = 0;
      form = (2 + att * 1.5) * ownBoost;
      break;
    default:
      xg = 0.04 * ownBoost;
      xa = 0.04 * ownBoost;
  }

  return {
    ...p,
    xg: Math.round(xg * 100) / 100,
    xa: Math.round(xa * 100) / 100,
    form: Math.round(form * 100) / 100,
    minutes: 900,
  };
}

/** Ensure xP / radar have usable inputs (FPL season data or FIFA price priors). */
export function hydrateWcPlayer(p: WcPlayer): WcPlayer {
  if (hasSeasonStats(p)) return p;
  return applyProvisionalWcPriors(p);
}

export function hydrateWcPlayers(players: WcPlayer[]): WcPlayer[] {
  return players.map(hydrateWcPlayer);
}
