import type { PreseasonLineup, PreseasonLineupPlayer } from "@/lib/fpl/preseason";
import type { PreseasonMatchRef } from "@/lib/fpl/preseason-sources";
import { opponentNamesMatch } from "@/lib/fpl/preseason-opponents";

const PL_LINEUP_ALIASES: Partial<Record<string, string[]>> = {
  MUN: ["Manchester United", "Man Utd", "Man United"],
  MCI: ["Manchester City", "Man City"],
  CHE: ["Chelsea", "Chelsea FC"],
  TOT: ["Spurs", "Tottenham Hotspur", "Tottenham"],
  AVL: ["Villa", "Aston Villa"],
  NEW: ["Newcastle United", "Newcastle", "NUFC"],
  NFO: ["Forest", "Nottingham Forest"],
  WHU: ["West Ham", "West Ham United"],
  WOL: ["Wolves", "Wolverhampton Wanderers"],
  BHA: ["Brighton", "Brighton and Hove Albion"],
  BOU: ["Bournemouth", "AFC Bournemouth"],
  CRY: ["Crystal Palace", "Palace"],
  LIV: ["Liverpool"],
  ARS: ["Arsenal"],
  EVE: ["Everton"],
  FUL: ["Fulham"],
  BRE: ["Brentford"],
  LEE: ["Leeds United", "Leeds"],
  IPS: ["Ipswich Town", "Ipswich"],
  SUN: ["Sunderland"],
};

function plTeamLabels(match: PreseasonMatchRef & { pl_code?: string }): string[] {
  const labels = new Set<string>([match.pl_name]);
  for (const alias of PL_LINEUP_ALIASES[match.pl_code ?? ""] ?? []) {
    labels.add(alias);
  }
  return [...labels];
}

function teamNameMatchesPl(teamName: string, match: PreseasonMatchRef & { pl_code?: string }): boolean {
  const t = teamName.trim().toLowerCase();
  for (const label of plTeamLabels(match)) {
    const l = label.toLowerCase();
    if (t === l || t.includes(l) || l.includes(t)) return true;
  }
  return false;
}

function normalizeMatchCentreHtml(html: string): string {
  return html.replace(/\\"/g, '"');
}

function parsePlayersFromMatchCentreArray(
  chunk: string,
  match: PreseasonMatchRef,
  isSub: boolean,
): PreseasonLineupPlayer[] {
  const out: PreseasonLineupPlayer[] = [];
  const seen = new Set<string>();

  const playerPattern = /"firstName":"([^"]*)","lastName":"([^"]*)"/g;
  for (const m of chunk.matchAll(playerPattern)) {
    const after = chunk.slice(m.index ?? 0, (m.index ?? 0) + 500);
    const shirtNumber = after.match(/"shirtNumber":(\d+)/)?.[1];
    if (!shirtNumber) continue;

    const name = `${m[1].trim()} ${m[2].trim()}`.replace(/\s+/g, " ").trim();
    if (!name || opponentNamesMatch(name, match.opponent)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let minute_on: number | null = null;
    const subOn = after.match(/"event":"SubOn"[\s\S]{0,120}?"minute":"(\d+)'/);
    if (subOn) minute_on = Number(subOn[1]);

    out.push({
      name,
      number: Number(shirtNumber),
      minute_on: isSub ? minute_on : null,
    });
  }

  return out;
}

function extractLineupChunk(html: string, markerIdx: number, maxLen = 120_000): string {
  const window = html.slice(markerIdx, markerIdx + maxLen);
  const subsStop = window.indexOf('"substitutes":[');
  if (subsStop > 0) return window.slice(0, subsStop);
  return window;
}

function parseTeamLineupBlock(
  html: string,
  startingIdx: number,
  match: PreseasonMatchRef & { pl_code?: string },
): PreseasonLineup | null {
  const header = html.slice(Math.max(0, startingIdx - 900), startingIdx);
  const teamNameMatches = [...header.matchAll(/"teamName":"([^"]+)"/g)];
  const teamName = teamNameMatches.at(-1)?.[1];
  if (!teamName || !teamNameMatchesPl(teamName, match)) return null;

  const formationMatches = [...header.matchAll(/"formation":"([^"]+)"/g)];
  const formation = formationMatches.at(-1)?.[1]?.trim() || null;

  const starterChunk = extractLineupChunk(html, startingIdx);
  const starters = parsePlayersFromMatchCentreArray(starterChunk, match, false);
  if (starters.length < 7) return null;

  let subs: PreseasonLineupPlayer[] = [];
  const afterStarters = html.slice(
    startingIdx + starterChunk.length,
    startingIdx + starterChunk.length + 80_000,
  );
  const subsIdx = afterStarters.indexOf('"substitutes":[');
  if (subsIdx >= 0) {
    subs = parsePlayersFromMatchCentreArray(
      extractLineupChunk(afterStarters, subsIdx),
      match,
      true,
    );
  }

  return {
    formation,
    starters: starters.slice(0, 11),
    subs,
  };
}

/** Parse embedded match-centre JSON (Man Utd, some Chelsea pages). */
export function parseMatchCentreLineupFromHtml(
  html: string,
  match: PreseasonMatchRef & { pl_code?: string },
): PreseasonLineup | null {
  const normalized = normalizeMatchCentreHtml(html);
  let best: PreseasonLineup | null = null;
  let idx = 0;

  while (idx < normalized.length) {
    const startingIdx = normalized.indexOf('"starting":[', idx);
    if (startingIdx < 0) break;

    const lineup = parseTeamLineupBlock(normalized, startingIdx, match);
    if (lineup) {
      const score = lineup.starters.length * 10 + lineup.subs.length;
      const bestScore = (best?.starters.length ?? 0) * 10 + (best?.subs.length ?? 0);
      if (score > bestScore) best = lineup;
      if (lineup.starters.length >= 11) return lineup;
    }
    idx = startingIdx + 12;
  }

  return best;
}
