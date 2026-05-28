import type { WcPlayer } from "@/lib/wc/types";

/** Reference minutes so per-90 math treats prior xG/xA as season-style totals. */
const PRIOR_REF_MINUTES = 810;

function hasSeasonStats(p: WcPlayer): boolean {
  return (
    !p.provisional &&
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

  let xg90 = 0;
  let xa90 = 0;
  let form = 2 + att * 2;

  switch (p.position) {
    case "FWD":
      xg90 = (0.06 + att * 0.14) * ownBoost;
      xa90 = (0.03 + att * 0.06) * ownBoost;
      form = (3 + att * 4) * ownBoost;
      break;
    case "MID":
      xg90 = (0.04 + att * 0.09) * ownBoost;
      xa90 = (0.05 + att * 0.09) * ownBoost;
      form = (3 + att * 3) * ownBoost;
      break;
    case "DEF":
      xg90 = (0.015 + att * 0.03) * ownBoost;
      xa90 = (0.02 + att * 0.04) * ownBoost;
      form = (2 + att * 2) * ownBoost;
      break;
    case "GKP":
      xg90 = 0;
      xa90 = 0;
      form = (2 + att * 1.5) * ownBoost;
      break;
    default:
      xg90 = 0.04 * ownBoost;
      xa90 = 0.04 * ownBoost;
  }

  const toSeason = (per90: number) =>
    Math.round(((per90 * PRIOR_REF_MINUTES) / 90) * 1000) / 1000;

  return {
    ...p,
    xg: toSeason(xg90),
    xa: toSeason(xa90),
    form: Math.round(form * 100) / 100,
    minutes: PRIOR_REF_MINUTES,
    provisional: true,
  };
}

/** Ensure xP / radar have usable inputs (FPL season data or FIFA price priors). */
export function hydrateWcPlayer(p: WcPlayer): WcPlayer {
  if (hasSeasonStats(p)) return { ...p, provisional: false };
  return applyProvisionalWcPriors(p);
}

export function hydrateWcPlayers(players: WcPlayer[]): WcPlayer[] {
  return players.map(hydrateWcPlayer);
}
