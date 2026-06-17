export type WcNewsRegion =
  | "US"
  | "UK"
  | "EU"
  | "LATAM"
  | "APAC"
  | "GLOBAL";

export type WcNewsFeedSource = {
  id: string;
  outlet: string;
  region: WcNewsRegion;
  lang: string;
  url: string;
  /** Keep items whose title+summary match (for broad feeds). */
  filter?: RegExp;
  editorialBias?: boolean;
};

export type WcNewsItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  outlet: string;
  region: WcNewsRegion;
  lang: string;
  feed_id: string;
  editorial_score: number;
  is_editorial: boolean;
};

/** Only include articles published within this window (72 hours). */
export const WC_NEWS_MAX_AGE_MS = 72 * 60 * 60 * 1000;
export const WC_NEWS_MAX_AGE_HOURS = 72;

function isWithinNewsWindow(
  publishedAt: string | null,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  if (!publishedAt) return false;
  const ts = Date.parse(publishedAt);
  if (!Number.isFinite(ts)) return false;
  return nowMs - ts <= maxAgeMs && ts <= nowMs + 60_000;
}

/** Google News + major outlets — editorial / analysis bias where possible. */
export const WC_NEWS_FEEDS: WcNewsFeedSource[] = [
  {
    id: "gn-us-editorial",
    outlet: "Google News",
    region: "US",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial+OR+column+OR+analysis)+when:3d&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gn-uk-editorial",
    outlet: "Google News",
    region: "UK",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial+OR+comment)+when:3d&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-au-editorial",
    outlet: "Google News",
    region: "APAC",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+analysis)+when:3d&hl=en-AU&gl=AU&ceid=AU:en",
  },
  {
    id: "gn-ca-editorial",
    outlet: "Google News",
    region: "US",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial)+when:3d&hl=en-CA&gl=CA&ceid=CA:en",
  },
  {
    id: "gn-de-kommentar",
    outlet: "Google News",
    region: "EU",
    lang: "de",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=WM+2026+(Kommentar+OR+Analyse+OR+Meinung)+when:3d&hl=de&gl=DE&ceid=DE:de",
  },
  {
    id: "gn-es-opinion",
    outlet: "Google News",
    region: "EU",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis+OR+columna)+when:3d&hl=es&gl=ES&ceid=ES:es",
  },
  {
    id: "gn-fr-editorial",
    outlet: "Google News",
    region: "EU",
    lang: "fr",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Coupe+du+monde+2026+(opinion+OR+analyse+OR+%C3%A9ditorial)+when:3d&hl=fr&gl=FR&ceid=FR:fr",
  },
  {
    id: "gn-it-editorial",
    outlet: "Google News",
    region: "EU",
    lang: "it",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mondiale+2026+(opinione+OR+editoriale+OR+analisi)+when:3d&hl=it&gl=IT&ceid=IT:it",
  },
  {
    id: "gn-br-opiniao",
    outlet: "Google News",
    region: "LATAM",
    lang: "pt",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Copa+do+Mundo+2026+(opini%C3%A3o+OR+an%C3%A1lise+OR+coluna)+when:3d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    id: "gn-mx-editorial",
    outlet: "Google News",
    region: "LATAM",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis)+when:3d&hl=es-419&gl=MX&ceid=MX:es-419",
  },
  {
    id: "gn-ar-editorial",
    outlet: "Google News",
    region: "LATAM",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis)+when:3d&hl=es-419&gl=AR&ceid=AR:es-419",
  },
  {
    id: "gn-zh-comment",
    outlet: "Google News",
    region: "APAC",
    lang: "zh",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=%E4%B8%96%E7%95%8C%E6%9D%AF+2026+(%E8%AF%84%E8%AE%BA+OR+%E4%B8%93%E6%A0%8F+OR+%E7%82%B9%E8%AF%84)+when:3d&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
  },
  {
    id: "gn-jp-editorial",
    outlet: "Google News",
    region: "APAC",
    lang: "ja",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=%E3%83%AF%E3%83%BC%E3%83%AB%E3%83%89%E3%82%AB%E3%83%83%E3%83%97+2026+%E8%A7%A3%E8%AA%AC+when:3d&hl=ja&gl=JP&ceid=JP:ja",
  },
  {
    id: "gn-in-analysis",
    outlet: "Google News",
    region: "APAC",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion+OR+column)+when:3d&hl=en-IN&gl=IN&ceid=IN:en",
  },
  {
    id: "gn-ng-analysis",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion)+when:3d&hl=en-NG&gl=NG&ceid=NG:en",
  },
  {
    id: "gn-za-analysis",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion)+when:3d&hl=en-ZA&gl=ZA&ceid=ZA:en",
  },
  {
    id: "guardian-wc2026",
    outlet: "The Guardian",
    region: "UK",
    lang: "en",
    url: "https://www.theguardian.com/football/world-cup-2026/rss",
  },
  {
    id: "bbc-football",
    outlet: "BBC Sport",
    region: "UK",
    lang: "en",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    filter: /world cup|worldcup|fifa|2026/i,
  },
  {
    id: "sky-football",
    outlet: "Sky Sports",
    region: "UK",
    lang: "en",
    url: "https://www.skysports.com/rss/12040",
    filter: /world cup|worldcup|fifa|2026/i,
  },
  {
    id: "espn-soccer",
    outlet: "ESPN",
    region: "US",
    lang: "en",
    url: "https://www.espn.com/espn/rss/soccer/news",
    filter: /world cup|worldcup|fifa|2026/i,
  },
  {
    id: "nyt-soccer",
    outlet: "NY Times",
    region: "US",
    lang: "en",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Soccer.xml",
    filter: /world cup|worldcup|fifa|2026/i,
  },
];

const FETCH_HEADERS = {
  Accept: "application/rss+xml, application/xml, text/xml, */*",
  "User-Agent": "FPL-LLM/1.0 (+https://faleague-ai.com; World Cup news aggregator)",
};

const EDITORIAL_RE =
  /\b(opinion|op-ed|editorial|column|comment|commentary|analysis|analyse|analyze|perspective|viewpoint|pundit|essay|think piece|hot take|meinung|kommentar|analyse|opini[oó]n|an[aá]lisis|columna|opini[aã]o|coluna|[\u8bc4\u70b9\u8bba\u4e13\u680f]|[\u89e3\u8aaa\u30a8\u30c7\u30a3\u30c8\u30ea\u30a2\u30eb])\b/i;

const WC_RE =
  /world cup|worldcup|fifa|wm 2026|mundial|coupe du monde|mondiale|copa do mundo|\u4e16\u754c\u676f|\u30ef\u30fc\u30eb\u30c9\u30ab\u30c3\u30d7|2026/i;

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(Number.parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim();
}

function stripHtml(html: string): string {
  return decodeXmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  );
  const m = block.match(re);
  return m?.[1] ? decodeXmlEntities(m[1].trim()) : "";
}

function extractLink(block: string): string {
  const plain = extractTag(block, "link").trim();
  if (plain.startsWith("http")) return plain;
  const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
}

function parseRssItems(xml: string): Array<{
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  outlet: string | null;
}> {
  const items: Array<{
    title: string;
    url: string;
    summary: string;
    published_at: string | null;
    outlet: string | null;
  }> = [];

  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, "title"));
    const url = extractLink(block);
    if (!title || !url) continue;

    const summary = stripHtml(
      extractTag(block, "description") ||
        extractTag(block, "summary") ||
        extractTag(block, "content"),
    ).slice(0, 400);

    const pubRaw =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated") ||
      extractTag(block, "dc:date");

    let published_at: string | null = null;
    if (pubRaw) {
      const ts = Date.parse(pubRaw);
      published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
    }

    const sourceTag = extractTag(block, "source");
    const outlet = sourceTag || null;

    items.push({ title, url, summary, published_at, outlet });
  }

  if (items.length === 0) {
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
    for (const block of entries) {
      const title = stripHtml(extractTag(block, "title"));
      const url =
        extractLink(block) ||
        extractTag(block, "id").trim();
      if (!title || !url.startsWith("http")) continue;
      const summary = stripHtml(
        extractTag(block, "summary") || extractTag(block, "content"),
      ).slice(0, 400);
      const pubRaw =
        extractTag(block, "published") || extractTag(block, "updated");
      let published_at: string | null = null;
      if (pubRaw) {
        const ts = Date.parse(pubRaw);
        published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
      }
      items.push({ title, url, summary, published_at, outlet: null });
    }
  }

  return items;
}

function editorialScore(title: string, summary: string, feed: WcNewsFeedSource): number {
  const text = `${title} ${summary}`;
  let score = feed.editorialBias ? 1 : 0;
  if (EDITORIAL_RE.test(text)) score += 3;
  if (WC_RE.test(text)) score += 1;
  return score;
}

function dedupeKey(title: string, url: string): string {
  const normTitle = title
    .toLowerCase()
    .replace(/\s*[-–|]\s*[^-|–]+$/, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  try {
    const u = new URL(url);
    return `${normTitle}|${u.hostname}${u.pathname}`.slice(0, 240);
  } catch {
    return `${normTitle}|${url}`.slice(0, 240);
  }
}

async function fetchFeedXml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchWcNewsItems(opts?: {
  limit?: number;
  editorialOnly?: boolean;
  maxAgeMs?: number;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(150, Math.max(20, opts?.limit ?? 100));
  const editorialOnly = opts?.editorialOnly ?? false;
  const maxAgeMs = opts?.maxAgeMs ?? WC_NEWS_MAX_AGE_MS;
  const nowMs = Date.now();

  const batches = await Promise.all(
    WC_NEWS_FEEDS.map(async (feed) => {
      const xml = await fetchFeedXml(feed.url);
      if (!xml) return [] as WcNewsItem[];

      const parsed = parseRssItems(xml);
      const out: WcNewsItem[] = [];

      for (const row of parsed) {
        if (!isWithinNewsWindow(row.published_at, nowMs, maxAgeMs)) continue;

        const text = `${row.title} ${row.summary}`;
        if (feed.filter && !feed.filter.test(text)) continue;
        if (!feed.filter && !feed.editorialBias && !WC_RE.test(text)) continue;

        const score = editorialScore(row.title, row.summary, feed);
        if (editorialOnly && score < 2) continue;

        const outlet = row.outlet || feed.outlet;
        out.push({
          id: `${feed.id}:${dedupeKey(row.title, row.url)}`,
          title: row.title,
          url: row.url,
          summary: row.summary,
          published_at: row.published_at,
          outlet,
          region: feed.region,
          lang: feed.lang,
          feed_id: feed.id,
          editorial_score: score,
          is_editorial: score >= 3,
        });
      }
      return out;
    }),
  );

  const seen = new Set<string>();
  const merged: WcNewsItem[] = [];
  for (const item of batches.flat()) {
    const key = dedupeKey(item.title, item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  merged.sort((a, b) => {
    if (b.editorial_score !== a.editorial_score) {
      return b.editorial_score - a.editorial_score;
    }
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  return merged.slice(0, limit);
}

let cache: { at: number; items: WcNewsItem[]; editorialOnly: boolean } | null =
  null;
const CACHE_MS = 20 * 60 * 1000;

export async function getCachedWcNews(opts?: {
  limit?: number;
  editorialOnly?: boolean;
  refresh?: boolean;
  maxAgeMs?: number;
}): Promise<{
  items: WcNewsItem[];
  cached: boolean;
  fetched_at: string;
  max_age_hours: number;
}> {
  const editorialOnly = opts?.editorialOnly ?? false;
  const maxAgeMs = opts?.maxAgeMs ?? WC_NEWS_MAX_AGE_MS;
  const now = Date.now();

  if (
    !opts?.refresh &&
    cache &&
    cache.editorialOnly === editorialOnly &&
    now - cache.at < CACHE_MS
  ) {
    const limit = opts?.limit ?? 100;
    return {
      items: cache.items.slice(0, limit),
      cached: true,
      fetched_at: new Date(cache.at).toISOString(),
      max_age_hours: WC_NEWS_MAX_AGE_HOURS,
    };
  }

  const items = await fetchWcNewsItems({
    limit: 150,
    editorialOnly,
    maxAgeMs,
  });
  cache = { at: now, items, editorialOnly };

  const limit = opts?.limit ?? 100;
  return {
    items: items.slice(0, limit),
    cached: false,
    fetched_at: new Date(now).toISOString(),
    max_age_hours: WC_NEWS_MAX_AGE_HOURS,
  };
}
