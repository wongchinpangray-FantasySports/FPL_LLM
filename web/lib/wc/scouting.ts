import type { WcXpRow } from "@/lib/wc/data";
import type { WcPlayer } from "@/lib/wc/types";
import { isScoutingExcluded } from "@/lib/wc/spotlight-clubs";
import { wcTeamFullName } from "@/lib/wc/team-names";

export type WcScoutArchetype =
  | "hidden_killer"
  | "unsung_hero"
  | "silent_wall"
  | "indestructible_gate";

export const SCOUT_ARCHETYPES: WcScoutArchetype[] = [
  "hidden_killer",
  "unsung_hero",
  "silent_wall",
  "indestructible_gate",
];

const ARCHETYPE_POSITION: Record<WcScoutArchetype, string> = {
  hidden_killer: "FWD",
  unsung_hero: "MID",
  silent_wall: "DEF",
  indestructible_gate: "GKP",
};

/** Max template popularity — above this, not a “hidden” gem. */
const MAX_SELECTION_PCT = 12;

const TOP_N = 12;

export type WcScoutPick = {
  id: number;
  name: string;
  team_code: string;
  team_name: string;
  position: string;
  price: number | null;
  selection_pct: number;
  xp_total: number;
  gem_score: number;
  insight: string;
  fpl_linked: boolean;
};

export type WcScoutingReport = {
  picks: Record<WcScoutArchetype, WcScoutPick[]>;
  scanned: number;
  excluded_spotlight: number;
  excluded_popular: number;
};

function avgFixtureFdr(byMd: WcXpRow["byMd"]): number {
  const cells = Object.values(byMd);
  if (cells.length === 0) return 3;
  return cells.reduce((s, c) => s + c.fdr, 0) / cells.length;
}

function gemScore(
  player: WcPlayer,
  xp: WcXpRow,
): number {
  const sel = player.selection_pct;
  const price = player.price ?? 5.5;
  const ownershipEdge = Math.max(0, (MAX_SELECTION_PCT - sel) / MAX_SELECTION_PCT);
  const valueEdge = Math.max(0, (7 - Math.min(7, price)) / 7);
  const xpEdge = xp.xp_total / 12;
  const fdr = avgFixtureFdr(xp.byMd);
  const fixtureEdge = Math.max(0, (5 - fdr) / 4);

  let score =
    xpEdge * 4.2 +
    ownershipEdge * 3.5 +
    valueEdge * 1.8;

  switch (player.position) {
    case "FWD":
      score += player.xg * 2.5 + player.form * 0.15;
      break;
    case "MID":
      score += player.xa * 2.2 + player.assists * 0.08 + player.form * 0.12;
      break;
    case "DEF":
      score += fixtureEdge * 2 + player.xg * 0.5;
      break;
    case "GKP":
      score += fixtureEdge * 2.5 + player.form * 0.1;
      break;
  }

  return Math.round(score * 100) / 100;
}

function buildInsight(player: WcPlayer, xp: WcXpRow): string {
  const sel = player.selection_pct;
  const price = player.price ?? 0;
  const fdr = avgFixtureFdr(xp.byMd).toFixed(1);
  const parts: string[] = [];

  if (sel < 2) parts.push("under 2% owned");
  else if (sel < 5) parts.push("low template risk");
  else parts.push("still outside the elite bracket");

  if (price > 0 && price <= 5) parts.push(`bargain $${price.toFixed(1)}m`);
  else if (price > 0) parts.push(`$${price.toFixed(1)}m`);

  parts.push(`${xp.xp_total.toFixed(1)} proj. xP`);
  parts.push(`avg FDR ${fdr}`);

  if (player.fpl_id != null && (player.xg > 0.1 || player.minutes > 0)) {
    parts.push("FPL form backed");
  } else {
    parts.push("FIFA pool differential");
  }

  return parts.slice(0, 4).join(" · ");
}

export function buildWcScoutingReport(
  players: WcPlayer[],
  xpRows: WcXpRow[],
  clubByFplId: Map<number, string>,
): WcScoutingReport {
  const xpById = new Map(xpRows.map((r) => [r.id, r]));
  const candidates: { player: WcPlayer; xp: WcXpRow; score: number }[] = [];

  let excluded_spotlight = 0;
  let excluded_popular = 0;

  for (const player of players) {
    const xp = xpById.get(player.id);
    if (!xp) continue;

    const club_name = player.fpl_id != null ? clubByFplId.get(player.fpl_id) : null;

    if (
      isScoutingExcluded({
        fpl_id: player.fpl_id,
        club_name,
      })
    ) {
      excluded_spotlight++;
      continue;
    }

    if (player.selection_pct > MAX_SELECTION_PCT) {
      excluded_popular++;
      continue;
    }

    const score = gemScore(player, xp);
    candidates.push({ player, xp, score });
  }

  const picks = {} as Record<WcScoutArchetype, WcScoutPick[]>;
  for (const archetype of SCOUT_ARCHETYPES) {
    const pos = ARCHETYPE_POSITION[archetype];
    picks[archetype] = candidates
      .filter((c) => c.player.position === pos)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map(({ player, xp, score }) => ({
        id: player.id,
        name: player.name,
        team_code: player.team_code,
        team_name: wcTeamFullName(player.team_code),
        position: player.position,
        price: player.price,
        selection_pct: player.selection_pct,
        xp_total: xp.xp_total,
        gem_score: score,
        insight: buildInsight(player, xp),
        fpl_linked: player.fpl_id != null,
      }));
  }

  return {
    picks,
    scanned: players.length,
    excluded_spotlight,
    excluded_popular,
  };
}
