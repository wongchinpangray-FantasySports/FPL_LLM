import type { PreseasonLineup, PreseasonLineupPlayer } from "@/lib/fpl/preseason";
import type { PreseasonMatchRef } from "@/lib/fpl/preseason-sources";
import { opponentNamesMatch } from "@/lib/fpl/preseason-opponents";
import { fetchPreseasonReportHtml } from "@/lib/fpl/preseason-report-goals";
import { buildClubReportUrlCandidates } from "@/lib/fpl/preseason-club-report-urls";
import { parseMatchCentreLineupFromHtml } from "@/lib/fpl/preseason-match-centre-lineups";

const BLOCKED_NAMES = new Set([
  "goals",
  "referee",
  "venue",
  "weather",
  "attendance",
  "yellow cards",
  "match data",
  "trialist",
  "home",
  "away",
  "substitutes",
  "subs",
  "starting xi",
  "line-ups",
  "line-up",
]);

const PL_CLUB_DOMAINS: Partial<Record<string, RegExp>> = {
  ARS: /arsenal\.com/i,
  AVL: /readastonvilla\.com|avfc\.co\.uk/i,
  BOU: /afcb\.co\.uk/i,
  BRE: /brentfordfc\.com/i,
  BHA: /brightonandhovealbion\.com/i,
  CHE: /chelseafc\.com/i,
  CRY: /cpfc\.co\.uk/i,
  EVE: /evertonfc\.com/i,
  FUL: /fulhamfc\.com/i,
  IPS: /ipswichtown\.co\.uk/i,
  LIV: /liverpoolfc\.com/i,
  LEE: /leedsunited\.com/i,
  LEI: /lcfc\.com/i,
  MCI: /mancity\.com/i,
  MUN: /manutd\.com/i,
  NEW: /newcastleunited\.com|nufc\.com/i,
  NFO: /nottinghamforest\.co\.uk/i,
  SUN: /safc\.com/i,
  TOT: /tottenhamhotspur\.com/i,
  WHU: /whufc\.com/i,
  WOL: /wolves\.co\.uk/i,
};

const PL_LINEUP_ALIASES: Partial<Record<string, string[]>> = {
  MUN: ["Manchester United", "Man Utd", "Man United"],
  TOT: ["Spurs", "Tottenham Hotspur", "Tottenham"],
  AVL: ["Villa", "Aston Villa"],
  NEW: ["Newcastle United", "Newcastle", "NUFC"],
  NFO: ["Forest", "Nottingham Forest"],
  WHU: ["West Ham", "West Ham United"],
  WOL: ["Wolves", "Wolverhampton Wanderers"],
  BHA: ["Brighton", "Brighton and Hove Albion"],
  BOU: ["Bournemouth", "AFC Bournemouth"],
};

function normalizeApostrophes(raw: string): string {
  return raw.replace(/[\u2018\u2019\u2032`´]/g, "'");
}

function stripHtml(html: string): string {
  return normalizeApostrophes(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#8217;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function cleanPlayerName(name: string): string {
  return name
    .replace(/\(c\)/gi, "")
    .replace(/\(C\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinute(raw: string): number | null {
  const m = raw.match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

function isValidLineupPlayerName(name: string, match: PreseasonMatchRef): boolean {
  const n = cleanPlayerName(name);
  if (n.length < 2 || n.length > 40) return false;
  if (BLOCKED_NAMES.has(n.toLowerCase())) return false;
  if (/^(yellow|red)\s+cards?$/i.test(n)) return false;
  if (/^trialist$/i.test(n)) return false;
  if (opponentNamesMatch(n, match.opponent)) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(n)) return false;
  if (/^\d+$/.test(n)) return false;
  return /^[A-ZÀ-ÿ][A-Za-zÀ-ÿ''\-]+(?:\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ''\-]+){0,3}$/.test(n);
}

function splitCommaRespectingParens(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseCommaLineupSection(
  section: string,
  match: PreseasonMatchRef,
): { starters: PreseasonLineupPlayer[]; subs: PreseasonLineupPlayer[] } {
  const starters: PreseasonLineupPlayer[] = [];
  const subs: PreseasonLineupPlayer[] = [];
  const seenStarter = new Set<string>();
  const seenSub = new Set<string>();

  for (const token of splitCommaRespectingParens(section)) {
    const rest = token.trim();
    if (!rest) continue;

    const starterName = cleanPlayerName(rest.replace(/\([^)]*\)/g, "").trim());
    if (starterName && isValidLineupPlayerName(starterName, match)) {
      const key = starterName.toLowerCase();
      if (!seenStarter.has(key)) {
        seenStarter.add(key);
        starters.push({ name: starterName, number: null });
      }
    }

    for (const subMatch of rest.matchAll(/\(([^)]+)\)/g)) {
      const inner = subMatch[1].trim();
      if (/^c$/i.test(inner)) continue;
      const subParts = inner.match(/^(.+?)\s+(\d{1,3})\s*'?$/);
      if (!subParts) continue;
      const subName = cleanPlayerName(subParts[1]);
      if (!isValidLineupPlayerName(subName, match)) continue;
      const key = subName.toLowerCase();
      if (seenSub.has(key)) continue;
      seenSub.add(key);
      subs.push({
        name: subName,
        number: null,
        minute_on: parseMinute(subParts[2]),
      });
    }
  }

  return { starters, subs };
}

function plLineupLabels(match: PreseasonMatchRef & { pl_code?: string }): string[] {
  const labels = new Set<string>([match.pl_name]);
  const code = match.pl_code ?? "";
  for (const alias of PL_LINEUP_ALIASES[code] ?? []) {
    labels.add(alias);
  }
  const first = match.pl_name.split(" ")[0];
  if (first) labels.add(first);
  return [...labels].sort((a, b) => b.length - a.length);
}

function urlIsPlClubReport(url: string, plCode: string): boolean {
  const re = PL_CLUB_DOMAINS[plCode];
  return re ? re.test(url) : false;
}

function extractPlLineupSection(
  plain: string,
  match: PreseasonMatchRef & { pl_code?: string },
): string | null {
  for (const label of plLineupLabels(match)) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const marker = plain.match(new RegExp(`${escaped}\\s*:`, "i"));
    if (!marker || marker.index == null) continue;

    const start = marker.index + marker[0].length;
    const tail = plain.slice(start);
    const end = tail.search(
      /\.\s*(?:Match data|Goals:|Referee:|Venue:|Attendance:|Yellow Cards:)/i,
    );
    const section = (end >= 0 ? tail.slice(0, end) : tail).trim();
    if (section.length > 15) return section;
  }
  return null;
}

function parseLineUpsBlock(
  plain: string,
  match: PreseasonMatchRef & { pl_code?: string },
): PreseasonLineup | null {
  const blockMatch = plain.match(/Line-ups([\s\S]+?)\.\s*Match data/i);
  const block = blockMatch
    ? `Line-ups${blockMatch[1]}`
    : plain.match(/Line-ups[\s\S]+?(?=Referee:|Venue:|Attendance:|Yellow Cards:|$)/i)?.[0];
  if (!block) return null;

  const section = extractPlLineupSection(block, match);
  if (!section) return null;

  const { starters, subs } = parseCommaLineupSection(section, match);
  if (starters.length < 7) return null;
  return { formation: null, starters: starters.slice(0, 11), subs };
}

function parseSemicolonLineUp(
  plain: string,
  match: PreseasonMatchRef,
): PreseasonLineup | null {
  const m = plain.match(
    /line-up\s+([A-ZÀ-ÿ][^.\n]+(?:;[^.\n]+)+)(?:\.\s*Goals|\.\s*<|$)/i,
  );
  if (!m?.[1]) return null;

  const names: PreseasonLineupPlayer[] = [];
  const seen = new Set<string>();
  for (const group of m[1].split(";")) {
    for (const part of group.split(",")) {
      const name = cleanPlayerName(part.trim());
      if (!isValidLineupPlayerName(name, match)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push({ name, number: null });
    }
  }
  if (names.length < 7) return null;
  return { formation: null, starters: names.slice(0, 11), subs: [] };
}

function parseStartingXiBlock(
  plain: string,
  match: PreseasonMatchRef & { pl_code?: string },
  url: string,
): PreseasonLineup | null {
  if (!match.pl_code || !urlIsPlClubReport(url, match.pl_code)) return null;

  const block = plain.match(
    /starting XI:\s*([\s\S]+?)(?=(?:[A-Za-z .]+subs:|Substitutes:|Yellow Cards:|Att:|Attendance:|$))/i,
  );
  if (!block?.[1]) return null;

  const { starters, subs: inlineSubs } = parseCommaLineupSection(block[1], match);
  const subsBlock = plain.match(/(?:Substitutes|subs):\s*([^.\n]+)/i)?.[1];
  const extraSubs = subsBlock
    ? parseCommaLineupSection(subsBlock, match).starters
    : [];

  const subs: PreseasonLineupPlayer[] = [...inlineSubs];
  const seen = new Set(inlineSubs.map((p) => p.name.toLowerCase()));
  for (const p of extraSubs) {
    const key = p.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    subs.push({ ...p, minute_on: null });
  }

  if (starters.length < 7) return null;
  return { formation: null, starters: starters.slice(0, 11), subs };
}

function lineupQuality(lineup: PreseasonLineup): number {
  return lineup.starters.length * 10 + lineup.subs.length;
}

function mergeLineupCandidates(
  candidates: PreseasonLineup[],
): PreseasonLineup | null {
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => lineupQuality(b) - lineupQuality(a))[0];
}

export function parseMatchReportLineupFromUrl(
  html: string,
  url: string,
  match: PreseasonMatchRef & { pl_code?: string },
): PreseasonLineup | null {
  const fromCentre = parseMatchCentreLineupFromHtml(html, match);
  if (fromCentre) return fromCentre;

  const plain = stripHtml(html);
  const candidates: PreseasonLineup[] = [];

  const fromLineUps = parseLineUpsBlock(plain, match);
  if (fromLineUps) candidates.push(fromLineUps);

  const fromSemi = parseSemicolonLineUp(plain, match);
  if (fromSemi) candidates.push(fromSemi);

  const fromXi = parseStartingXiBlock(plain, match, url);
  if (fromXi) candidates.push(fromXi);

  return mergeLineupCandidates(candidates);
}

export async function fetchLineupFromReportUrl(
  url: string,
  match: PreseasonMatchRef & { pl_code?: string },
): Promise<PreseasonLineup | null> {
  const html = await fetchPreseasonReportHtml(url);
  if (!html) return null;
  return parseMatchReportLineupFromUrl(html, url, match);
}

export async function fetchLineupForFinishedMatch(
  match: PreseasonMatchRef & {
    pl_code?: string;
    status?: string;
    lineup?: PreseasonLineup | null;
  },
  reportUrls: string[] = [],
  opts?: { skipDiscovery?: boolean },
): Promise<PreseasonLineup | null> {
  if (match.status !== "finished") return null;
  const existing = match.lineup?.starters?.length ?? 0;
  if (existing >= 11) return match.lineup ?? null;

  const { discoverWebMatchReportUrls, sortPreseasonReportUrls } = await import(
    "@/lib/fpl/preseason-report-goals"
  );

  const discovered = opts?.skipDiscovery
    ? []
    : await discoverWebMatchReportUrls(match);
  const clubUrls = buildClubReportUrlCandidates(match);
  const candidates = sortPreseasonReportUrls([
    ...clubUrls,
    ...reportUrls,
    ...discovered,
  ]).slice(0, 10);

  let best: PreseasonLineup | null = null;
  let bestScore = 0;
  const seen = new Set<string>();

  for (const url of candidates) {
    if (seen.has(url)) continue;
    seen.add(url);

    const lineup = await fetchLineupFromReportUrl(url, match);
    if (!lineup) continue;
    const score = lineupQuality(lineup);
    if (score > bestScore) {
      best = lineup;
      bestScore = score;
      if (lineup.starters.length >= 11 && lineup.subs.length >= 3) break;
    }
  }

  if (
    best &&
    match.lineup?.starters?.length &&
    lineupQuality(best) <= lineupQuality(match.lineup)
  ) {
    return match.lineup;
  }

  return best;
}
