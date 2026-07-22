/**
 * Free pre-season result sources: Premier League official article + RSS headlines.
 */

const PL_API = "https://api.premierleague.com";
const PL_SITE = "https://www.premierleague.com";
const PL_PRESEASON_ARTICLE_ID = 4606700;

const PL_HEADERS: Record<string, string> = {
  Accept: "application/json",
  Origin: PL_SITE,
  Referer: `${PL_SITE}/en/news`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "X-Pulse-Application-Name": "web",
  "X-Pulse-Application-Version": "v1.48.0",
};

/** PL display names in the official article → our pl_code values. */
export const PL_TEAM_CODES: Record<string, string> = {
  arsenal: "ARS",
  "aston villa": "AVL",
  villa: "AVL",
  bournemouth: "BOU",
  brentford: "BRE",
  brighton: "BHA",
  "brighton & hove albion": "BHA",
  chelsea: "CHE",
  "coventry city": "COV",
  coventry: "COV",
  "crystal palace": "CRY",
  palace: "CRY",
  everton: "EVE",
  fulham: "FUL",
  "hull city": "HUL",
  hull: "HUL",
  "ipswich town": "IPS",
  ipswich: "IPS",
  "leeds united": "LEE",
  leeds: "LEE",
  liverpool: "LIV",
  "man city": "MCI",
  "manchester city": "MCI",
  "man utd": "MUN",
  "manchester united": "MUN",
  newcastle: "NEW",
  "nott'm forest": "NFO",
  "nottingham forest": "NFO",
  forest: "NFO",
  sunderland: "SUN",
  spurs: "TOT",
  tottenham: "TOT",
  "tottenham hotspur": "TOT",
};

const RSS_FEEDS = [
  {
    id: "express-star",
    url: "https://www.expressandstar.com/sport/football/rss/",
  },
  {
    id: "bbc-football",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
  },
  {
    id: "bbc-epl",
    url: "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml",
  },
  {
    id: "google-preseason",
    url: "https://news.google.com/rss/search?q=pre-season+friendly+Premier+League+when:3d&hl=en-GB&gl=GB&ceid=GB:en",
  },
] as const;

export type PreseasonExternalResult = {
  date: string;
  homeName: string;
  awayName: string;
  homeGoals: number;
  awayGoals: number;
  source: "pl-official" | "rss";
  feedId?: string;
  reportUrl?: string;
};

export type PreseasonMatchRef = {
  date: string;
  pl_code: string;
  pl_name: string;
  opponent: string;
  pl_home: boolean;
  status: string;
  pl_goals?: number | null;
  opp_goals?: number | null;
};

export type PreseasonAppliedUpdate = {
  status: "finished" | "scheduled";
  pl_goals: number | null;
  opp_goals: number | null;
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function normTeam(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9'\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamMatches(a: string, b: string): boolean {
  const x = normTeam(a);
  const y = normTeam(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  const yTokens = y.split(" ").filter((t) => t.length > 2);
  if (yTokens.length === 0) return false;
  return yTokens.every((t) => x.includes(t));
}

function plCodeForName(name: string): string | null {
  const n = normTeam(name);
  if (PL_TEAM_CODES[n]) return PL_TEAM_CODES[n];
  for (const [label, code] of Object.entries(PL_TEAM_CODES)) {
    if (teamMatches(n, label)) return code;
  }
  return null;
}

function parseMonthDay(text: string, year = 2026): string | null {
  const m = text.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  if (!month || !Number.isFinite(day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoDateOnly(iso: string): string | null {
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a}T12:00:00Z`);
  const db = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function htmlToLines(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h5>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function stripResultSuffix(text: string): string {
  return text
    .replace(/\s+Report$/i, "")
    .replace(/\s+Details$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

function parseScoreLine(
  line: string,
  fallbackDate?: string,
  source: PreseasonExternalResult["source"] = "pl-official",
): PreseasonExternalResult | null {
  const scoreMatch = line.match(/(\d+)\s*-\s*(\d+)/);
  if (!scoreMatch || scoreMatch.index == null) return null;

  const homeGoals = Number(scoreMatch[1]);
  const awayGoals = Number(scoreMatch[2]);
  if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) return null;

  const before = line.slice(0, scoreMatch.index).trim();
  const after = stripResultSuffix(line.slice(scoreMatch.index + scoreMatch[0].length).trim());
  if (!before || !after) return null;

  let date = fallbackDate ?? null;
  let homeName = before;
  const datePrefix = before.match(/^(\d{1,2}\s+[A-Za-z]+)\s+(.+)$/);
  if (datePrefix) {
    date = parseMonthDay(datePrefix[1]) ?? date;
    homeName = datePrefix[2].trim();
  }

  if (!date) return null;

  return {
    date,
    homeName,
    awayName: after,
    homeGoals,
    awayGoals,
    source,
  };
}

function parsePlArticleBody(body: string): PreseasonExternalResult[] {
  const lines = htmlToLines(body);
  const results: PreseasonExternalResult[] = [];
  let section: "none" | "recent" | "club" = "none";
  let currentDate: string | undefined;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower === "recent results") {
      section = "recent";
      currentDate = undefined;
      continue;
    }
    if (lower === "upcoming matches") {
      section = "none";
      currentDate = undefined;
      continue;
    }
    if (lower === "club-by-club matches") {
      section = "club";
      currentDate = undefined;
      continue;
    }

    const headingDate = line.match(/^(\d{1,2}\s+[A-Za-z]+)$/);
    if (headingDate && section === "recent") {
      currentDate = parseMonthDay(headingDate[1]) ?? currentDate;
      continue;
    }

    if (!/\d+\s*-\s*\d+/.test(line)) continue;
    if (/community shield/i.test(line)) continue;

    const parsed = parseScoreLine(line, currentDate, "pl-official");
    if (parsed) results.push(parsed);
  }

  return dedupeExternalResults(results);
}

async function fetchPlArticleBody(): Promise<string | null> {
  try {
    const res = await fetch(
      `${PL_API}/content/premierleague/text/en/${PL_PRESEASON_ARTICLE_ID}?detail=DETAILED`,
      {
        headers: PL_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { body?: string };
    return data.body?.trim() || null;
  } catch {
    return null;
  }
}

function parseScoreFromText(text: string): PreseasonExternalResult | null {
  const cleaned = text
    .replace(/^pre-season:\s*/i, "")
    .replace(/\s+-\s+.*$/, "")
    .trim();

  const patterns = [
    /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+(.+?)$/,
    /^(.+?)\s+beat\s+(.+?)\s+(\d+)\s*[-–]\s*(\d+)$/i,
    /^(.+?)\s+(\d+)\s*[-–]\s*(\d+)\s+win\s+over\s+(.+?)$/i,
  ];

  for (const pattern of patterns) {
    const m = cleaned.match(pattern);
    if (!m) continue;
    if (pattern === patterns[0]) {
      return {
        date: "",
        homeName: m[1].trim(),
        awayName: m[4].trim(),
        homeGoals: Number(m[2]),
        awayGoals: Number(m[3]),
        source: "rss",
      };
    }
    if (pattern === patterns[1]) {
      return {
        date: "",
        homeName: m[1].trim(),
        awayName: m[2].trim(),
        homeGoals: Number(m[3]),
        awayGoals: Number(m[4]),
        source: "rss",
      };
    }
    return {
      date: "",
      homeName: m[4].trim(),
      awayName: m[1].trim(),
      homeGoals: Number(m[3]),
      awayGoals: Number(m[2]),
      source: "rss",
    };
  }

  return null;
}

function parseRssXml(xml: string, feedId: string): PreseasonExternalResult[] {
  const results: PreseasonExternalResult[] = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const items = xml.match(itemRe) ?? [];

  for (const item of items) {
    const title =
      item.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1]?.trim() ??
      item.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ??
      "";
    if (!title) continue;

    const friendlyRe =
      /pre-season|preseason|friendly|friendlies|summer\s+match/i;
    if (!friendlyRe.test(title) && !/\d+\s*[-–]\s*\d+/.test(title)) continue;

    const parsed = parseScoreFromText(title);
    if (!parsed) continue;

    const pub =
      item.match(/<dc:date>([^<]+)<\/dc:date>/i)?.[1] ??
      item.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1] ??
      "";
    parsed.date = isoDateOnly(pub) ?? parsed.date;
    parsed.feedId = feedId;
    parsed.reportUrl =
      item.match(/<link>([^<]+)<\/link>/i)?.[1]?.trim() ?? undefined;
    if (!parsed.date) continue;

    results.push(parsed);
  }

  return results;
}

function dedupeExternalResults(
  rows: PreseasonExternalResult[],
): PreseasonExternalResult[] {
  const out: PreseasonExternalResult[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const key = [
      row.date,
      normTeam(row.homeName),
      normTeam(row.awayName),
      row.homeGoals,
      row.awayGoals,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }

  return out;
}

export async function fetchPlPreseasonResults(): Promise<PreseasonExternalResult[]> {
  const body = await fetchPlArticleBody();
  if (!body) return [];
  return parsePlArticleBody(body);
}

export async function fetchRssPreseasonResults(): Promise<PreseasonExternalResult[]> {
  const batches = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssXml(xml, feed.id);
      } catch {
        return [];
      }
    }),
  );

  return dedupeExternalResults(batches.flat());
}

export async function fetchAllPreseasonExternalResults(): Promise<
  PreseasonExternalResult[]
> {
  const [pl, rss] = await Promise.all([
    fetchPlPreseasonResults(),
    fetchRssPreseasonResults(),
  ]);

  // Official PL article first; RSS fills gaps (e.g. before PL updates the article).
  return dedupeExternalResults([...pl, ...rss]);
}

export function externalResultMatchesMatch(
  result: PreseasonExternalResult,
  match: PreseasonMatchRef,
): boolean {
  if (daysApart(result.date, match.date) > 1) return false;

  const plHome =
    teamMatches(result.homeName, match.pl_name) &&
    teamMatches(result.awayName, match.opponent);
  const plAway =
    teamMatches(result.awayName, match.pl_name) &&
    teamMatches(result.homeName, match.opponent);

  if (plHome || plAway) return true;

  const plCode = plCodeForName(match.pl_name);
  const oppCode = plCodeForName(match.opponent);
  const homeCode = plCodeForName(result.homeName);
  const awayCode = plCodeForName(result.awayName);

  if (
    plCode &&
    homeCode === plCode &&
    teamMatches(result.awayName, match.opponent)
  ) {
    return true;
  }
  if (
    plCode &&
    awayCode === plCode &&
    teamMatches(result.homeName, match.opponent)
  ) {
    return true;
  }
  if (
    oppCode &&
    homeCode === oppCode &&
    teamMatches(result.awayName, match.pl_name)
  ) {
    return true;
  }
  if (
    oppCode &&
    awayCode === oppCode &&
    teamMatches(result.homeName, match.pl_name)
  ) {
    return true;
  }

  return false;
}

export function applyExternalResultToMatch(
  match: PreseasonMatchRef,
  result: PreseasonExternalResult,
): PreseasonAppliedUpdate | null {
  if (!externalResultMatchesMatch(result, match)) return null;

  const plIsHome = teamMatches(result.homeName, match.pl_name);
  const pl_goals = plIsHome ? result.homeGoals : result.awayGoals;
  const opp_goals = plIsHome ? result.awayGoals : result.homeGoals;

  return {
    status: "finished",
    pl_goals,
    opp_goals,
  };
}

export function mergeExternalResultsOntoMatch<
  T extends PreseasonMatchRef,
>(match: T, results: PreseasonExternalResult[]): T & PreseasonAppliedUpdate {
  const base: T & PreseasonAppliedUpdate = {
    ...match,
    status: match.status === "finished" ? "finished" : "scheduled",
    pl_goals: match.pl_goals ?? null,
    opp_goals: match.opp_goals ?? null,
  };

  for (const result of results) {
    const applied = applyExternalResultToMatch(match, result);
    if (applied) return { ...base, ...applied };
  }

  return base;
}

export function preseasonAppliedChanged(
  before: PreseasonMatchRef,
  after: PreseasonAppliedUpdate,
): boolean {
  return (
    before.status !== after.status ||
    (before.pl_goals ?? null) !== after.pl_goals ||
    (before.opp_goals ?? null) !== after.opp_goals
  );
}

let externalCache: {
  at: number;
  results: PreseasonExternalResult[];
} | null = null;

const EXTERNAL_CACHE_MS = 15 * 60 * 1000;

export function clearPreseasonExternalCache(): void {
  externalCache = null;
}

export async function loadCachedPreseasonExternalResults(): Promise<
  PreseasonExternalResult[]
> {
  if (externalCache && Date.now() - externalCache.at < EXTERNAL_CACHE_MS) {
    return externalCache.results;
  }
  const results = await fetchAllPreseasonExternalResults();
  externalCache = { at: Date.now(), results };
  return results;
}
