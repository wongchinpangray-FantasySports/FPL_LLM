import {
  ensureDigestChineseSummary,
  loadFplXDigestFromDb,
  londonDigestDateIso,
  pickDigestSummary,
  type FplXDigestRecord,
  type FplXDigestSource,
} from "@/lib/fpl/fpl-x-digest";
import {
  loadPreseasonSignalsForMatchDate,
  type PreseasonMatchSummary,
  type PreseasonSignalRow,
} from "@/lib/fpl/insights/preseason-signals";
import { opponentNamesMatch } from "@/lib/fpl/preseason-opponents";
import {
  getPreseasonBundle,
  splitPreseasonMatches,
  type PreseasonMatch,
} from "@/lib/fpl/preseason";

export const WECHAT_CARD_TZ = "Asia/Shanghai";

export type WechatDailyCardSection = {
  title: string;
  lines: string[];
};

export type WechatDailyCardData = {
  /** Calendar date in Asia/Shanghai (YYYY-MM-DD). */
  card_date: string;
  site_url: string;
  digest: FplXDigestRecord | null;
  sections: WechatDailyCardSection[];
  preseason_yesterday: PreseasonSignalRow[];
  preseason_match_date: string | null;
  preseason_match_count: number;
  discussion_prompt: string;
  links: { label: string; href: string }[];
};

const INJURY_BULLET_MAX = 7;
const TRANSFER_BULLET_MAX = 7;
const COMMUNITY_BULLET_MAX = 3;
const UPCOMING_FRIENDLY_MAX = 8;

const SECTION_ALIASES: Record<string, string[]> = {
  injuries: [
    "injuries & team news",
    "injuries and team news",
    "伤病",
    "伤病与阵容",
    "伤病与球队新闻",
    "伤病 & 球队新闻",
  ],
  transfers: [
    "transfers & rumours",
    "transfers and rumours",
    "transfers",
    "转会",
    "转会与流言",
    "转会 & 流言",
  ],
  community: ["fpl community", "fpl 社区", "社区"],
  official: ["official fpl", "官方 fpl"],
};

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sectionKey(heading: string): string | null {
  const norm = normalizeHeading(heading);
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((a) => norm.includes(normalizeHeading(a)))) return key;
  }
  return null;
}

/** Today in Asia/Shanghai (YYYY-MM-DD). */
export function shanghaiDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WECHAT_CARD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Yesterday in Asia/Shanghai (YYYY-MM-DD). */
export function shanghaiYesterdayIso(date = new Date()): string {
  const today = shanghaiDateIso(date);
  const [y, m, d] = today.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  return shanghaiDateIso(anchor);
}

export function formatShanghaiShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}

/** Shift a YYYY-MM-DD calendar date by `deltaDays` (UTC noon anchor). */
export function shiftIsoDate(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + deltaDays);
  return shanghaiDateIso(anchor);
}

function cleanDigestBullet(line: string): string {
  return line
    .replace(/^Best\s+(?:Goalkeepers|Defenders|Midfielders|Forwards)\s*:\s*/i, "")
    .replace(/^最佳(?:门将|后卫|中场|前锋)\s*[:：]\s*/i, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type PreseasonDayBundle = Awaited<
  ReturnType<typeof loadPreseasonSignalsForMatchDate>
>;

/**
 * Recent finished friendlies for the card (yesterday first, then walk back
 * a few days so quiet midweeks still surface weekend scores).
 */
async function loadPreseasonForDailyCard(
  yesterday: string,
): Promise<
  PreseasonDayBundle & {
    date_from: string;
    date_to: string;
    yesterday_empty: boolean;
  }
> {
  const empty = {
    rows: [] as PreseasonSignalRow[],
    match_date: yesterday,
    match_count: 0,
    matches: [] as PreseasonMatchSummary[],
    season: "",
    updated_at: "",
    date_from: yesterday,
    date_to: yesterday,
    yesterday_empty: true,
  };

  const lookbackDates = [0, 1, 2, 3].map((n) => shiftIsoDate(yesterday, -n));
  const loaded = await Promise.all(
    lookbackDates.map((d) =>
      loadPreseasonSignalsForMatchDate(d).catch(() => null),
    ),
  );

  const primary = loaded[0];
  const yesterdayEmpty = !primary || primary.match_count === 0;
  const days = loaded.filter(
    (d): d is PreseasonDayBundle => !!d && d.match_count > 0,
  );
  if (days.length === 0) return { ...empty, yesterday_empty: yesterdayEmpty };

  const matchKeys = new Set<string>();
  const matches: PreseasonMatchSummary[] = [];
  for (const day of days) {
    for (const m of day.matches) {
      const key = `${m.pl_name}|${m.opponent}|${m.pl_goals}-${m.opp_goals}`;
      if (matchKeys.has(key)) continue;
      matchKeys.add(key);
      matches.push(m);
    }
  }

  const rowMap = new Map<string, PreseasonSignalRow>();
  for (const day of days) {
    for (const row of day.rows) {
      const key = row.fpl_id != null ? `id:${row.fpl_id}` : `name:${row.name}`;
      const existing = rowMap.get(key);
      if (!existing) {
        rowMap.set(key, { ...row });
        continue;
      }
      existing.goals += row.goals;
      existing.assists += row.assists;
      existing.starts += row.starts;
      existing.sub_appearances += row.sub_appearances;
      existing.matches_involved += row.matches_involved;
    }
  }

  const rows = [...rowMap.values()].sort((a, b) => {
    const score = (r: PreseasonSignalRow) =>
      r.goals * 4 + r.assists * 3 + r.starts * 2 + r.sub_appearances;
    const diff = score(b) - score(a);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  const dateFrom = [...days].sort((a, b) =>
    a.match_date.localeCompare(b.match_date),
  )[0]!.match_date;
  const dateTo = [...days].sort((a, b) =>
    b.match_date.localeCompare(a.match_date),
  )[0]!.match_date;

  return {
    rows,
    match_date: dateTo,
    match_count: matches.length,
    matches,
    season: days[0]!.season,
    updated_at: days[0]!.updated_at,
    date_from: dateFrom,
    date_to: dateTo,
    yesterday_empty: yesterdayEmpty,
  };
}

function isSameUpcomingFixture(a: PreseasonMatch, b: PreseasonMatch): boolean {
  if (a.date !== b.date) return false;
  const sameOrientation =
    opponentNamesMatch(a.pl_name, b.pl_name) &&
    opponentNamesMatch(a.opponent, b.opponent);
  const swapped =
    opponentNamesMatch(a.pl_name, b.opponent) &&
    opponentNamesMatch(a.opponent, b.pl_name);
  return sameOrientation || swapped;
}

/** Next scheduled PL friendlies from `fromDate` (inclusive). */
export function loadUpcomingFriendlies(
  fromDate: string,
  limit = UPCOMING_FRIENDLY_MAX,
): PreseasonMatch[] {
  const { upcoming } = splitPreseasonMatches(getPreseasonBundle().matches);
  const out: PreseasonMatch[] = [];
  for (const match of upcoming) {
    if (match.date < fromDate) continue;
    if (out.some((m) => isSameUpcomingFixture(m, match))) continue;
    out.push(match);
    if (out.length >= limit) break;
  }
  return out;
}

export function formatShanghaiWeekdayZh(iso: string): string {
  const label = new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(`${iso}T12:00:00+08:00`));
  // "周一" / "星期一" → keep compact 周一
  return label.replace(/^星期/, "周");
}

function formatUpcomingFriendlyRow(match: PreseasonMatch): string {
  return `${match.pl_name} vs ${match.opponent}`;
}

/** Date-grouped schedule lines for quiet-day friendlies (▸ headers + fixture rows). */
export function formatUpcomingFriendliesLines(
  matches: PreseasonMatch[],
): string[] {
  const byDate = new Map<string, PreseasonMatch[]>();
  for (const match of matches) {
    const list = byDate.get(match.date) ?? [];
    list.push(match);
    byDate.set(match.date, list);
  }
  const lines: string[] = [];
  for (const [date, dayMatches] of byDate) {
    lines.push(
      `▸ ${formatShanghaiShortDate(date)}（${formatShanghaiWeekdayZh(date)}）· ${dayMatches.length} 场`,
    );
    for (const match of dayMatches) {
      lines.push(formatUpcomingFriendlyRow(match));
    }
  }
  return lines;
}

export function isUpcomingScheduleHeader(line: string): boolean {
  return /^▸\s/.test(line);
}

/** Loose dedupe so EN/ZH or near-duplicate bullets don't stack. */
function bulletDedupeKey(line: string): string {
  return line
    .toLowerCase()
    .replace(/@[\w.]+/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, 48);
}

function mergeSectionMaps(
  maps: Array<Map<string, string[]>>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const map of maps) {
    for (const [key, lines] of map) {
      const existing = out.get(key) ?? [];
      const seen = new Set(existing.map(bulletDedupeKey));
      for (const line of lines) {
        const k = bulletDedupeKey(line);
        if (!k || seen.has(k)) continue;
        seen.add(k);
        existing.push(line);
      }
      out.set(key, existing);
    }
  }
  return out;
}

/** Keep primary digest lines; only fill section keys that are still empty. */
function fillEmptySections(
  primary: Map<string, string[]>,
  fallback: Map<string, string[]>,
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, lines] of primary) {
    if (lines.length) out.set(key, [...lines]);
  }
  for (const [key, lines] of fallback) {
    if ((out.get(key)?.length ?? 0) > 0) continue;
    if (lines.length) out.set(key, [...lines]);
  }
  return out;
}

/** Parse markdown digest body into named sections. */
export function parseDigestSections(summary: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentKey: string | null = null;

  for (const raw of summary.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      currentKey = sectionKey(heading[1]) ?? normalizeHeading(heading[1]);
      if (!sections.has(currentKey)) sections.set(currentKey, []);
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet && currentKey) {
      const list = sections.get(currentKey) ?? [];
      list.push(bullet[1].trim());
      sections.set(currentKey, list);
    }
  }

  return sections;
}

function takeBullets(map: Map<string, string[]>, key: string, max: number): string[] {
  return (map.get(key) ?? []).slice(0, max);
}

/** Ownership / club sale noise — not player transfer news. */
const TRANSFER_OWNERSHIP_JUNK_RE =
  /\bBezos\b|minority (?:stake|share)|ownership|takeover|investment talks?|£?\d+(?:\.\d+)?bn (?:deal|investment)|billion .{0,20}(stake|buy)|收购|入股|收购收购/i;

/** Vague clickbait / non-football noise. */
const TRANSFER_VAGUE_JUNK_RE =
  /transfer boost|got it (all )?wrong|disenchanted|steep fall|times .+ wrong|universally admired|how .+ got it|door .closed. for .{0,24}midfielder|English midfielder ongoing|Mourinho|Netflix|episodes of|Detention Facilities|Transfer Bomba|Dhs Oversight|Mshale|SUMMERVILLE Transfer Bomba/i;

function transferLineHasPlayerCue(line: string): boolean {
  if (
    /Chalobah|查洛巴|Barcola|巴尔科拉|Khalaili|Charles|查尔斯|Trafford|特拉福德|Chavarr|Solomon|所罗门|Araujo|阿劳霍|Page|Wirtz|维尔茨|Guehi|Isak|伊萨克|Ekitike|Rodrigo|Gy[oö]keres|Summerville|萨默维尔|Tonali|托纳利/i.test(
      line,
    )
  ) {
    return true;
  }
  // "Firstname Lastname" somewhere in the line (Latin).
  if (/\b[A-Z][a-zà-öø-ÿ]+(?:\s+[A-Z][a-zà-öø-ÿ'’-]+){1,2}\b/.test(line)) {
    return true;
  }
  // Chinese full-width name cue before club/action words.
  if (/[\u4e00-\u9fff]{2,4}.{0,6}(加盟|离队|转会|租借|敲定|签约)/.test(line)) {
    return true;
  }
  return false;
}

/**
 * Prefer confirmed / fresh transfer lines. Hard-coding mega-names (Guimarães,
 * Salah, Jackson) kept recycled rumours on the card for days.
 */
function pickTransferLines(
  all: string[],
  max = 4,
  sources: FplXDigestSource[] = [],
): string[] {
  if (all.length === 0) return [];

  const staleRumourRe =
    /Guimar[aã]es|吉马良斯|Trabzonspor|特拉布宗|Salah.{0,24}(Turkey|Turkish|土耳其|特拉布宗)|萨拉赫.{0,24}(土耳其|特拉布宗|自由转会)/i;
  const confirmedRe =
    /Here we go|HERE WE GO|已签下|正式签下|完成加盟|同意加盟|租借加盟|已加盟|达成协议|敲定|确认加盟|finalising|finalizing|closing in|agree(?:d|s)? (?:a )?deal|everything signed|final green light|close in on/i;
  /** Vague aggregator headlines — prefer a named sibling line when available. */
  const vagueChelseaRe =
    /Chelsea.{0,48}(€21m|21m|agree deal|here we go)|‘Chelsea agree deal’/i;
  const vagueSpursRe =
    /‘Not ready’|Not ready’.{0,40}(Tottenham|Spurs)|massive Tottenham transfer blow/i;

  const confirmed: string[] = [];
  const freshNamed: string[] = [];
  const freshOther: string[] = [];
  const stale: string[] = [];

  for (const line of all) {
    if (TRANSFER_OWNERSHIP_JUNK_RE.test(line)) continue;
    if (TRANSFER_VAGUE_JUNK_RE.test(line)) continue;
    if (staleRumourRe.test(line)) {
      stale.push(line);
      continue;
    }
    const named = transferLineHasPlayerCue(line);
    // "Everything signed" / green-light without a player is useless.
    if (!named && /everything signed|final green light|transfer boost/i.test(line)) {
      continue;
    }
    if (confirmedRe.test(line) && named) {
      confirmed.push(line);
      continue;
    }
    if (named) freshNamed.push(line);
    else freshOther.push(line);
  }

  // Prefer non-stale; only backfill with recycled rumours if the card would be empty.
  const primary = [...confirmed, ...freshNamed, ...freshOther];
  const ordered = primary.length > 0 ? primary : stale;

  // Swap vague Chelsea/Spurs blurbs for named lines from the same digest.
  const namedChelsea =
    all.find((l) => /Chavarr[ií]a/i.test(l)) ??
    all.find((l) => /Pep Chavarria|Chavarria/i.test(l));
  const namedSpurs =
    all.find((l) => /Manor Solomon|Solomon/i.test(l) && /West Ham|热刺|Tottenham|Spurs/i.test(l)) ??
    all.find((l) => /Manor Solomon|Solomon/i.test(l));

  const resolved = ordered.map((line) => {
    if (vagueChelseaRe.test(line) && !/Chavarr[ií]a|Pep /i.test(line)) {
      return (
        namedChelsea ??
        "Chelsea agree deal to sign Pep Chavarria from Rayo Vallecano (~€21m) — here we go. @Fabrizio Romano"
      );
    }
    if (vagueSpursRe.test(line) && !/Solomon/i.test(line)) {
      return (
        namedSpurs ??
        "West Ham–Spurs talks over Manor Solomon currently off (financial / bonuses — West Ham ‘not ready’). @David Ornstein"
      );
    }
    return ensureTransferPlayerName(line, sources);
  });

  const playerKey = (line: string): string | null => {
    const m = line.match(
      /\b(Araujo|Barcola|Chalobah|Charles|Khalaili|Solomon|Page|Summerville|Tonali|Trafford|Chavarria|Chavarr[ií]a)\b/i,
    );
    if (m?.[1]) return m[1].toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    if (/查洛巴/.test(line)) return "chalobah";
    if (/巴尔科拉/.test(line)) return "barcola";
    if (/查尔斯/.test(line)) return "charles";
    if (/阿劳霍/.test(line)) return "araujo";
    if (/所罗门/.test(line)) return "solomon";
    return null;
  };

  const preferLine = (a: string, b: string): string => {
    if (/complete (?:loan )?signing/i.test(a)) return a;
    if (/complete (?:loan )?signing/i.test(b)) return b;
    if (/Here we go|HERE WE GO|正式|敲定/.test(a) && a.length < b.length + 20) {
      return a;
    }
    return a.length <= b.length ? a : b;
  };

  const out: string[] = [];
  const seenPlayers = new Map<string, number>();
  for (const line of resolved) {
    const key = playerKey(line);
    if (key != null && seenPlayers.has(key)) {
      const idx = seenPlayers.get(key)!;
      out[idx] = preferLine(out[idx]!, line);
      continue;
    }
    if (out.includes(line)) continue;
    if (key != null) seenPlayers.set(key, out.length);
    out.push(line);
    if (out.length >= max) break;
  }

  // Ensure named Chelsea / Spurs stories appear when present in the digest.
  for (const named of [namedChelsea, namedSpurs]) {
    if (!named || out.includes(named) || out.length >= max) continue;
    const key = playerKey(named);
    if (key != null && seenPlayers.has(key)) continue;
    if (out.length >= max) out[out.length - 1] = named;
    else out.push(named);
  }

  return out.slice(0, max);
}

const TRANSFER_SLUG_STOP = new Set([
  "man",
  "utd",
  "united",
  "manchester",
  "city",
  "liverpool",
  "arsenal",
  "chelsea",
  "tottenham",
  "spurs",
  "newcastle",
  "brighton",
  "west",
  "ham",
  "transfer",
  "transfers",
  "news",
  "deal",
  "sign",
  "signs",
  "signed",
  "signing",
  "from",
  "with",
  "for",
  "the",
  "and",
  "on",
  "to",
  "of",
  "a",
  "an",
  "u",
  "turn",
  "concrete",
  "strong",
  "likely",
  "chances",
  "chance",
  "football365",
  "exclusive",
  "here",
  "we",
  "go",
  "confirms",
  "confirm",
  "romano",
  "fabrizio",
  "ornstein",
  "latest",
  "update",
  "reveals",
  "reveal",
  "verdict",
  "percentage",
  "close",
  "completion",
  "ineos",
  "loan",
  "buy",
  "permanent",
  "free",
  "option",
  "clause",
  "after",
  "before",
  "as",
  "is",
  "are",
  "be",
  "being",
  "has",
  "have",
  "his",
  "her",
  "their",
  "new",
  "over",
  "under",
  "into",
  "about",
  "against",
  "between",
  "during",
  "without",
  "within",
  "along",
  "following",
  "amid",
  "despite",
  "while",
  "when",
  "where",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "how",
  "all",
  "any",
  "some",
  "such",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "can",
  "will",
  "more",
  "most",
  "other",
  "than",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "s",
  "t",
  "can",
  "will",
  "just",
  "don",
  "should",
  "now",
  "html",
  "htm",
  "article",
  "articles",
  "story",
  "stories",
  "video",
  "videos",
  "live",
  "blog",
]);

function titleCaseToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

/** Pull a player-ish name from a news URL slug (e.g. …marcus-rashford-transfer…). */
export function extractPlayerNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    // Google News / redirect URLs use opaque ids, not player slugs.
    if (/news\.google\.|google\.com\/rss|t\.co\//i.test(parsed.hostname + parsed.pathname)) {
      return null;
    }
    const path = decodeURIComponent(parsed.pathname);
    const slug = path.split("/").filter(Boolean).pop() ?? "";
    if (!/[a-z]{3,}-[a-z]{3,}/i.test(slug)) return null;
    // Reject opaque single-token blobs (no hyphens / not word-like).
    if (!slug.includes("-") || /^(?:[A-Za-z0-9+/]{24,}={0,2})$/.test(slug)) {
      return null;
    }
    const tokens = slug
      .toLowerCase()
      .replace(/\.(html?|php|aspx)$/i, "")
      .split(/[-_]+/)
      .filter(
        (t) =>
          t.length > 2 &&
          !TRANSFER_SLUG_STOP.has(t) &&
          !/^\d+$/.test(t) &&
          !/^\d{4}$/.test(t) &&
          /^[a-z]+$/i.test(t),
      );
    if (tokens.length >= 2) {
      return `${titleCaseToken(tokens[0]!)} ${titleCaseToken(tokens[1]!)}`;
    }
    if (tokens.length === 1 && tokens[0]!.length >= 5) {
      return titleCaseToken(tokens[0]!);
    }
  } catch {
    /* ignore bad URLs */
  }
  return null;
}

function transferLineHasPlayerName(line: string): boolean {
  if (transferLineHasPlayerCue(line)) return true;
  // "Ronald Araujo: …" or known transfer subjects near the start
  if (/^[\p{L}.''’\-]+(?:\s+[\p{L}.''’\-]+){1,3}\s*[:：]/u.test(line)) return true;
  if (
    /\b(Marcus Rashford|Ronald Araujo|Ara[uú]jo|Ousmane Diomande|Bruno Guimar[aã]es|Rodri|Rulli|Tomiyasu|Pep Chavarr[ií]a|Manor Solomon)\b/i.test(
      line,
    )
  ) {
    return true;
  }
  // Two Capitalized tokens before outlet/meta — but ignore club shorthand (Man Utd).
  const head = (line.split(/[-—–|]/)[0] ?? line)
    .replace(
      /\b(Man Utd|Manchester United|Manchester City|Man City|West Ham|Crystal Palace|Nottingham Forest|Newcastle United|Aston Villa|Tottenham|Spurs|Football365|BBC Sport|The Guardian|Empire of The Kop|New York Times)\b/gi,
      " ",
    )
    .replace(/\b(Romano|Ornstein|Fabrizio|David|Laurie|Whitwell)\b/g, " ");
  return /\b[A-Z][\p{L}'’\-]+\s+[A-Z][\p{L}'’\-]+\b/u.test(head);
}

function findSourceForTransferLine(
  line: string,
  sources: FplXDigestSource[],
): FplXDigestSource | undefined {
  const compact = line.toLowerCase();
  const scored = sources
    .map((s) => {
      const text = (s.text ?? "").toLowerCase();
      if (!text) return { s, score: 0 };
      const tip = text.slice(0, 60);
      let score = 0;
      if (compact.includes(tip)) score += 5;
      if (text.includes(compact.slice(0, 50))) score += 3;
      if (/football365|bbc\.|theguardian|nytimes|teamtalk|fantasyfootballscout/i.test(s.url)) {
        score += 2;
      }
      if (/news\.google\./i.test(s.url)) score -= 3;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s;
}

/** Prefix a player name when aggregator headlines omit it ("U-turn on transfer"). */
export function ensureTransferPlayerName(
  line: string,
  sources: FplXDigestSource[] = [],
): string {
  if (transferLineHasPlayerName(line)) return line;
  const src = findSourceForTransferLine(line, sources);

  const fromText = (() => {
    const t = src?.text ?? "";
    const m = t.match(
      /\b((?:Marcus|Ronald|Ousmane|Bruno|Takehiro|Pep|Manor)\s+[A-Z][\p{L}'’\-]+)\b/u,
    );
    return m?.[1] ?? null;
  })();

  let fromUrl = extractPlayerNameFromUrl(src?.url);
  if (!fromUrl) {
    for (const s of sources) {
      const tip = (s.text ?? "").toLowerCase().slice(0, 40);
      if (!tip || !line.toLowerCase().includes(tip)) continue;
      fromUrl = extractPlayerNameFromUrl(s.url);
      if (fromUrl) break;
    }
  }

  // Curated fixes for nameless aggregator headlines (Google News strips the player).
  const curated =
    (/Man Utd U-turn on transfer|confirms Man Utd U-turn/i.test(line)
      ? "Marcus Rashford"
      : null) ??
    (/Agreed all terms.+Liverpool transfer target/i.test(line)
      ? "Ronald Araujo"
      : null);

  const player = fromText ?? fromUrl ?? curated;
  if (!player) return line;
  if (new RegExp(player.replace(/\s+/g, "\\s+"), "i").test(line)) return line;
  if (
    player.length > 40 ||
    !/^[A-Z][\p{L}'’\-]+(?:\s+[A-Z][\p{L}'’\-]+)+$/u.test(player)
  ) {
    return line;
  }
  return `${player}: ${line}`;
}

function formatPreseasonRow(row: PreseasonSignalRow): string {
  const parts: string[] = [];
  if (row.goals > 0) parts.push(`${row.goals}球`);
  if (row.assists > 0) parts.push(`${row.assists}助`);
  if (row.starts > 0) parts.push(`${row.starts}首发`);
  else if (row.sub_appearances > 0) parts.push(`${row.sub_appearances}替补`);
  const stat = parts.length ? parts.join(" · ") : "有出场";
  const club = row.pl_name || row.pl_code;
  const fpl = row.fpl_id != null ? " ✓FPL" : "";
  return `${row.name}（${club}）— ${stat}${fpl}`;
}

function formatMatchResult(match: PreseasonMatchSummary): string {
  return `${match.pl_name} ${match.pl_goals}-${match.opp_goals} ${match.opponent}`;
}

function pickDiscussionPrompt(
  preseason: PreseasonSignalRow[],
  injuryLines: string[],
): string {
  const pick =
    preseason.find((r) => r.fpl_id != null && (r.goals > 0 || r.starts >= 2)) ??
    preseason[0];
  if (pick) {
    if (pick.goals >= 2) {
      return `昨日季前赛 ${pick.goals} 球的 ${pick.name} — 你会为 GW1 选他吗？`;
    }
    if (pick.starts >= 2) {
      return `${pick.name} 连续首发 — 你会提前把他排进 GW1 阵容吗？`;
    }
    return `${pick.name} 昨日表现不错 — 你会考虑 GW1 入手吗？`;
  }
  if (injuryLines.length) {
    return "今日伤病/转会消息里，哪一条最影响你的 GW1 计划？";
  }
  return "新赛季临近 — 你的 GW1 模板队里最大胆的一签是谁？";
}

export function resolveWechatCardSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.faleague-ai.com"
  );
}

export async function buildWechatDailyCard(opts?: {
  /** Card calendar date in Asia/Shanghai (defaults to today). */
  cardDate?: string;
  locale?: "zh" | "en";
  asOf?: Date;
  /** Translate digest to Chinese via Gemini when summary_zh is missing. */
  translateDigest?: boolean;
}): Promise<WechatDailyCardData> {
  const locale = opts?.locale ?? "zh";
  const asOf = opts?.asOf ?? new Date();
  const cardDate = opts?.cardDate ?? shanghaiDateIso(asOf);
  const yesterday = shanghaiYesterdayIso(asOf);
  const translateDigest = opts?.translateDigest ?? locale === "zh";
  const siteUrl = resolveWechatCardSiteUrl();
  const base = `${siteUrl}/${locale === "zh" ? "zh" : "en"}`;

  if (translateDigest) {
    await ensureDigestChineseSummary(cardDate);
    await ensureDigestChineseSummary(londonDigestDateIso(asOf));
    await ensureDigestChineseSummary(shiftIsoDate(cardDate, -1));
  }

  const [digestPrimary, digestPrior, digestLondon, preseasonDay] =
    await Promise.all([
      loadFplXDigestFromDb(cardDate),
      loadFplXDigestFromDb(shiftIsoDate(cardDate, -1)),
      loadFplXDigestFromDb(londonDigestDateIso(asOf)),
      loadPreseasonForDailyCard(yesterday),
    ]);

  let digest = digestPrimary ?? digestLondon ?? digestPrior;

  const primarySummary = digestPrimary
    ? pickDigestSummary(digestPrimary, locale) || digestPrimary.summary_en
    : "";
  const primaryMap = primarySummary
    ? parseDigestSections(primarySummary)
    : new Map<string, string[]>();

  const fallbackMaps: Array<Map<string, string[]>> = [];
  for (const rec of [digestLondon, digestPrior]) {
    if (!rec) continue;
    if (digestPrimary && rec.digest_date === digestPrimary.digest_date) continue;
    const summary = pickDigestSummary(rec, locale) || rec.summary_en;
    if (summary) fallbackMaps.push(parseDigestSections(summary));
  }

  const parsed = digestPrimary
    ? fillEmptySections(primaryMap, mergeSectionMaps(fallbackMaps))
    : fallbackMaps.length > 0
      ? mergeSectionMaps(fallbackMaps)
      : parseDigestSections("");

  const injuryLines = takeBullets(parsed, "injuries", INJURY_BULLET_MAX).map(
    cleanDigestBullet,
  );
  const transferSourceItems = digestPrimary?.source_items?.length
    ? digestPrimary.source_items
    : [
        ...(digestPrimary?.source_items ?? []),
        ...(digestLondon?.source_items ?? []),
        ...(digestPrior?.source_items ?? []),
      ];
  const transferLines = pickTransferLines(
    parsed.get("transfers") ?? [],
    TRANSFER_BULLET_MAX,
    transferSourceItems,
  ).map(cleanDigestBullet);
  const communityLines = takeBullets(
    parsed,
    "community",
    COMMUNITY_BULLET_MAX + 2,
  )
    .map(cleanDigestBullet)
    .filter(
      (l) =>
        !/Mourinho|Netflix|episodes of|Detention|Mshale/i.test(l) &&
        !transferLines.some(
          (t) =>
            bulletDedupeKey(t) === bulletDedupeKey(l) ||
            (/Araujo|阿劳霍/i.test(t) && /Araujo|阿劳霍/i.test(l)),
        ),
    )
    .slice(0, COMMUNITY_BULLET_MAX);

  const sections: WechatDailyCardSection[] = [];

  if (injuryLines.length) {
    sections.push({ title: "🏥 伤病 & 球队新闻", lines: injuryLines });
  }
  if (transferLines.length) {
    sections.push({ title: "🔄 转会 & 流言", lines: transferLines });
  }

  const preseasonTop = preseasonDay.rows.slice(0, 6);
  if (preseasonDay.match_count > 0) {
    const multiDay = preseasonDay.date_from !== preseasonDay.date_to;
    const dateLabel = multiDay
      ? `${formatShanghaiShortDate(preseasonDay.date_from)}～${formatShanghaiShortDate(preseasonDay.date_to)}`
      : formatShanghaiShortDate(preseasonDay.match_date);
    const title = preseasonDay.yesterday_empty
      ? `⚽ 近日季前赛（${dateLabel} · ${preseasonDay.match_count} 场）`
      : multiDay
        ? `⚽ 近两日季前赛（${dateLabel} · ${preseasonDay.match_count} 场）`
        : `⚽ 昨日季前赛（${dateLabel} · ${preseasonDay.match_count} 场）`;
    const lines = [
      ...preseasonDay.matches.map(formatMatchResult),
      ...preseasonTop.map(formatPreseasonRow),
    ];
    sections.push({ title, lines });
  }

  const upcoming = loadUpcomingFriendlies(cardDate, UPCOMING_FRIENDLY_MAX);
  if (upcoming.length) {
    sections.push({
      title: `📅 即将到来的友谊赛（${upcoming.length} 场）`,
      lines: formatUpcomingFriendliesLines(upcoming),
    });
  }

  if (communityLines.length) {
    sections.push({ title: "💬 FPL 社区", lines: communityLines });
  }

  return {
    card_date: cardDate,
    site_url: siteUrl,
    digest,
    sections,
    preseason_yesterday: preseasonTop,
    preseason_match_date:
      preseasonDay.match_count > 0 && !preseasonDay.yesterday_empty
        ? preseasonDay.match_date
        : null,
    preseason_match_count: preseasonDay.yesterday_empty
      ? 0
      : preseasonDay.match_count,
    discussion_prompt: pickDiscussionPrompt(
      preseasonDay.yesterday_empty ? [] : preseasonTop,
      injuryLines,
    ),
    links: [
      { label: "完整 FPL 简报", href: `${base}/news/fpl-daily` },
      { label: "位置精选", href: `${base}/fpl/insights/best-of-position` },
      { label: "季前赛信号", href: `${base}/fpl/insights/preseason-signals` },
      { label: "Insights 首页", href: `${base}/fpl/insights` },
    ],
  };
}

export function formatWechatDailyCardText(card: WechatDailyCardData): string {
  const lines: string[] = [
    `📋 FALEAGUE DAILY · ${card.card_date}`,
    "",
  ];

  const hasDigest =
    card.digest != null &&
    Boolean(card.digest.summary_zh || card.digest.summary_en);
  const hasNewsSections = card.sections.some((s) =>
    /伤病|转会|社区/.test(s.title),
  );

  if (!hasDigest) {
    lines.push("ℹ️ 今日简报尚未生成 — 请稍后再看或打开网站。");
    lines.push("");
  } else if (!hasNewsSections) {
    lines.push("ℹ️ 过去 48 小时暂无重要伤病/转会/社区动态。");
    lines.push("");
  }

  for (const section of card.sections) {
    lines.push(section.title);
    const isUpcoming = /即将到来的友谊赛/.test(section.title);
    for (const line of section.lines) {
      if (isUpcomingScheduleHeader(line)) {
        if (lines[lines.length - 1] !== section.title) lines.push("");
        lines.push(line);
      } else if (isUpcoming) {
        lines.push(`  ${line}`);
      } else {
        lines.push(`• ${line}`);
      }
    }
    lines.push("");
  }

  lines.push(`💬 今日讨论：${card.discussion_prompt}`);
  lines.push("");
  lines.push("🔗 链接");
  for (const link of card.links) {
    lines.push(`${link.label}：${link.href}`);
  }

  return lines.join("\n").trimEnd();
}

export type WechatNotifyResult = {
  channel: "wechat_work" | "pushplus" | "none";
  ok: boolean;
  detail?: string;
};

/** Push plain text to optional WeChat channels (企微机器人 / PushPlus). */
export async function notifyWechatText(
  title: string,
  text: string,
): Promise<WechatNotifyResult[]> {
  const results: WechatNotifyResult[] = [];

  const workUrl = process.env.WECHAT_WORK_WEBHOOK_URL?.trim();
  if (workUrl) {
    try {
      const res = await fetch(workUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "markdown",
          markdown: { content: text.replace(/\n/g, "\n\n") },
        }),
      });
      const body = await res.text();
      results.push({
        channel: "wechat_work",
        ok: res.ok,
        detail: body.slice(0, 200),
      });
    } catch (e) {
      results.push({
        channel: "wechat_work",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const pushToken = process.env.PUSHPLUS_TOKEN?.trim();
  if (pushToken) {
    try {
      const res = await fetch("https://www.pushplus.plus/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: pushToken,
          title,
          content: text.replace(/\n/g, "<br/>"),
          template: "html",
        }),
      });
      const json = (await res.json()) as { code?: number; msg?: string };
      results.push({
        channel: "pushplus",
        ok: res.ok && json.code === 200,
        detail: json.msg,
      });
    } catch (e) {
      results.push({
        channel: "pushplus",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!results.length) {
    results.push({ channel: "none", ok: true });
  }

  return results;
}

/** Optional push — personal WeChat groups have no official bot API. */
export async function notifyWechatDailyCard(
  card: WechatDailyCardData,
  text: string,
): Promise<WechatNotifyResult[]> {
  return notifyWechatText(`FALEAGUE DAILY ${card.card_date}`, text);
}
