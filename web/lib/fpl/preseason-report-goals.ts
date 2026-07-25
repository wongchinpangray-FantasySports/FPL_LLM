import type { PreseasonGoal } from "@/lib/fpl/preseason-enrich";
import { opponentNamesMatch } from "@/lib/fpl/preseason-opponents";
import type { PreseasonMatchRef } from "@/lib/fpl/preseason-sources";

const HTML_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPlayerName(name: string): string {
  return name
    .replace(/^\d+-year-old\s+/i, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNameList(text: string): string[] {
  return text
    .split(/,|\band\b/gi)
    .map((part) =>
      cleanPlayerName(part.replace(/\s+(helped|seal|secured|sealed|help).*$/i, "")),
    )
    .filter((name) => name.length > 1 && /[A-Za-z]/.test(name));
}

function goalKey(goal: PreseasonGoal): string {
  return `${goal.side}:${goal.scorer.toLowerCase()}:${goal.minute}:${goal.assist ?? ""}`;
}

function fitGoalsToScore(
  goals: PreseasonGoal[],
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plNeeded = match.pl_goals ?? 0;
  const oppNeeded = match.opp_goals ?? 0;
  const pl: PreseasonGoal[] = [];
  const opp: PreseasonGoal[] = [];
  const seen = new Set<string>();

  for (const goal of goals) {
    const key = goalKey(goal);
    if (seen.has(key)) continue;
    seen.add(key);
    if (goal.side === "opp") opp.push(goal);
    else pl.push(goal);
  }

  return [...pl.slice(0, plNeeded), ...opp.slice(0, oppNeeded)];
}

function inferSide(scorer: string, match: PreseasonMatchRef): "pl" | "opp" {
  const s = scorer.toLowerCase();
  const plFirst = match.pl_name.split(" ")[0]?.toLowerCase() ?? "";
  if (plFirst && s.includes(plFirst)) return "pl";
  if (opponentNamesMatch(scorer, match.opponent)) return "opp";
  const oppFirst = match.opponent.split(" ")[0]?.toLowerCase() ?? "";
  if (oppFirst && s.includes(oppFirst)) return "opp";
  if (/walsall|saddlers|dons forward|hosts|home side/i.test(scorer)) return "opp";
  return "pl";
}

const BLOCKED_SCORER_NAMES = new Set([
  "austria",
  "saalfelden",
  "hosts",
  "brentford",
  "brighton",
  "wycombe",
  "wimbledon",
  "england",
  "germany",
]);

function isValidScorerName(name: string, match?: PreseasonMatchRef): boolean {
  if (name.length < 3 || name.length > 32) return false;
  if (BLOCKED_SCORER_NAMES.has(name.toLowerCase())) return false;
  if (/^(but|when|hosts|the|and|with|after|before|their|moments)\b/i.test(name)) {
    return false;
  }
  if (/responded|break when|goal of their|took the lead|opened the scoring/i.test(name)) {
    return false;
  }
  if (/\(\d+\)$/.test(name)) return false;
  if (match) {
    const n = name.toLowerCase();
    const pl = match.pl_name.toLowerCase();
    if (n === pl || pl.startsWith(n) || n.includes(pl.split(" ")[0] ?? "")) {
      return false;
    }
  }
  return /^[A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+){0,3}$/.test(name);
}

function pushGoal(
  out: PreseasonGoal[],
  scorer: string,
  match: PreseasonMatchRef,
  minute = "",
  assist: string | null = null,
  sideOverride?: "pl" | "opp",
): void {
  const name = cleanPlayerName(scorer);
  if (!isValidScorerName(name, match)) return;
  out.push({
    minute,
    scorer: name,
    assist,
    side: sideOverride ?? inferSide(name, match),
  });
}

function parseGoalsFromListPhrase(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const listMatch =
    text.match(/goals from\s+([^.]+)/i) ??
    text.match(/([A-Z][a-zA-Z'’\- .,]+?)\s+were all on the scoresheet/i) ??
    text.match(/([A-Z][a-zA-Z'’\- .,]+?)\s+were also on target/i) ??
    text.match(/\b([A-Z][a-zA-Z'’\- ]+?)\s+scored as\b/i);
  if (!listMatch?.[1]) return out;
  for (const name of splitNameList(listMatch[1])) {
    pushGoal(out, name, match);
  }
  return out;
}

function parseNarrativeGoals(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const oppLabel = match.opponent.split(" ")[0] ?? match.opponent;

  const oppGoal = text.match(
    new RegExp(
      `${oppLabel}[^.]{0,120}?\\bwhen\\s+([A-Z][a-zA-Z'’\\-]+(?:\\s+[A-Z][a-zA-Z'’\\-]+)?)\\s+headed home`,
      "i",
    ),
  );
  if (oppGoal?.[1]) {
    pushGoal(out, oppGoal[1], match, "", null, "opp");
    return out;
  }

  const patterns: RegExp[] = [
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:scored|netted|equalised|equalized)\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:slotted|tapped home|headed home|converted)\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+)\s+tapped home\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:completed the turnaround|sealed the pre-season victory|sealed a victory)\b/gi,
  ];

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      if (/was alongside|featured|played \d|leading the line|partnered|joined/i.test(text)) {
        continue;
      }
      pushGoal(out, m[1], match);
    }
  }

  return out;
}

export function isPlausiblePreseasonScorerName(
  name: string,
  match?: PreseasonMatchRef,
): boolean {
  return isValidScorerName(name, match);
}

export function preseasonGoalsHaveInvalidRows(
  match: PreseasonMatchRef & { goals?: PreseasonGoal[] },
): boolean {
  return (match.goals ?? []).some((g) => !isValidScorerName(g.scorer, match));
}

export function parseGenericMatchReportGoals(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const paragraphs = [
    ...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
  ].map((m) => stripHtml(m[1]));

  const chunks = paragraphs.length ? paragraphs : plain.split(/(?<=[.!?])\s+/);
  const collected: PreseasonGoal[] = [];

  for (const chunk of chunks) {
    if (chunk.length < 20) continue;
    collected.push(...parseGoalsFromListPhrase(chunk, match));
    collected.push(...parseNarrativeGoals(chunk, match));
  }

  collected.push(...parseGoalsFromListPhrase(plain, match));
  collected.push(...parseNarrativeGoals(plain, match));

  return fitGoalsToScore(collected, match);
}

async function fetchReportHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status !== 200) return null;
    const html = await res.text();
    return html.length >= 1500 ? html : null;
  } catch {
    return null;
  }
}

function reportUrlPriority(url: string): number {
  const lower = url.toLowerCase();
  if (/bbc\.co(?:m|\.uk)\/sport\/football\/articles\//.test(lower)) return 0;
  if (/premierleague\.com\/en\/news\//.test(lower)) return 1;
  if (/brentfordfc\.com|brightonandhovealbion\.com|arsenal\.com|afcb\.co\.uk/.test(lower)) {
    return 2;
  }
  if (/espn\.com\/soccer\/story/.test(lower)) return 3;
  if (/vavel|particle|yahoo|hounslow|thescottishsun/.test(lower)) return 9;
  return 5;
}

function scoreMatchesResult(title: string, match: PreseasonMatchRef): boolean {
  const m = title.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return /friendly|pre-season|preseason/i.test(title);
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    (a === match.pl_goals && b === match.opp_goals) ||
    (a === match.opp_goals && b === match.pl_goals)
  );
}

function urlLooksLikeReport(url: string, match: PreseasonMatchRef): boolean {
  const lower = url.toLowerCase();
  if (
    /youtube|twitter|x\.com|facebook|instagram|sounds\.bbc|vavel|particle|yahoo|live-score|onefootball/i.test(
      lower,
    )
  ) {
    return false;
  }
  if (!/bbc\.co|brentfordfc|brightonandhovealbion|premierleague\.com\/en\/news|espn\.com\/soccer\/story|afcb\.co/i.test(lower)) {
    return /match-report|friendly|pre-season|preseason|articles\//i.test(lower);
  }
  const plToken = match.pl_name.split(" ")[0]?.toLowerCase() ?? "";
  const oppToken = match.opponent.split(" ")[0]?.toLowerCase() ?? "";
  return (
    lower.includes(plToken) ||
    lower.includes(oppToken) ||
    scoreMatchesResult(url, match)
  );
}

function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function probeReportUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: HTML_FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function guessClubReportUrls(match: PreseasonMatchRef): Promise<string[]> {
  const plGoals = match.pl_goals ?? 0;
  const oppGoals = match.opp_goals ?? 0;
  const oppSlug = slugifyTeam(match.opponent);

  const templates: Partial<Record<string, string[]>> = {
    BRE: [
      `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${plGoals}-${oppSlug}-${oppGoals}-behind-closed-doors-friendly-jaidon-anthony`,
      `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${plGoals}-${oppSlug}-${oppGoals}`,
    ],
    BHA: [
      "https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-wycombe-wanderers-july-2026",
      `https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-${oppSlug}-july-2026`,
    ],
    BOU: [
      "https://www.bbc.com/sport/football/articles/crrvd719xkwo",
      "https://www.bbc.co.uk/sport/football/articles/crrvd719xkwo",
    ],
  };

  const candidates = templates[match.pl_code] ?? [];
  const out: string[] = [];
  for (const url of candidates) {
    if (await probeReportUrl(url)) out.push(url);
  }
  return out;
}

async function discoverFromGoogleNewsRss(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const score =
    match.pl_goals != null && match.opp_goals != null
      ? `${match.pl_goals}-${match.opp_goals}`
      : "";
  const query = `${match.pl_name} ${score} ${match.opponent} friendly`.trim();
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`,
      { headers: HTML_FETCH_HEADERS, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const out: string[] = [];
    for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
      const title =
        item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ??
        "";
      if (!scoreMatchesResult(title, match)) continue;
      if (!title.toLowerCase().includes(match.pl_name.split(" ")[0]!.toLowerCase())) {
        continue;
      }
      if (/brentford fc/i.test(title)) {
        out.push(
          `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${match.pl_goals}-${slugifyTeam(match.opponent)}-${match.opp_goals}-behind-closed-doors-friendly-jaidon-anthony`,
        );
      }
      if (/brighton/i.test(title) && /wycombe/i.test(title)) {
        out.push(
          "https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-wycombe-wanderers-july-2026",
        );
      }
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

async function discoverFromDuckDuckGo(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const score =
    match.pl_goals != null && match.opp_goals != null
      ? `${match.pl_goals}-${match.opp_goals}`
      : "";
  const query = `${match.pl_name} ${score} ${match.opponent} friendly scorers`.trim();

  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: HTML_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    return [...html.matchAll(/uddg=([^&"]+)/g)]
      .map((m) => decodeURIComponent(m[1]))
      .filter((url) => urlLooksLikeReport(url, match))
      .sort((a, b) => reportUrlPriority(a) - reportUrlPriority(b));
  } catch {
    return [];
  }
}

export async function discoverWebMatchReportUrls(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const [guessed, fromNews, fromDdg] = await Promise.all([
    guessClubReportUrls(match),
    discoverFromGoogleNewsRss(match),
    discoverFromDuckDuckGo(match),
  ]);

  return [...new Set([...guessed, ...fromNews, ...fromDdg])]
    .sort((a, b) => reportUrlPriority(a) - reportUrlPriority(b))
    .slice(0, 8);
}

export async function fetchGoalsFromReportUrl(
  url: string,
  match: PreseasonMatchRef,
): Promise<PreseasonGoal[]> {
  const html = await fetchReportHtml(url);
  if (!html) return [];

  if (url.includes("espn.com/soccer/story")) {
    const { parseEspnStoryGoals } = await import("@/lib/fpl/preseason-scorers");
    return parseEspnStoryGoals(html, match);
  }

  return parseGenericMatchReportGoals(html, match);
}
