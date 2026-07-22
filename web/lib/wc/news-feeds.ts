export type WcNewsRegion =
  | "US"
  | "UK"
  | "EU"
  | "LATAM"
  | "APAC"
  | "GLOBAL";

export type NewsCategory =
  | "trending"
  | "transfer"
  | "epl"
  | "worldcup"
  | "leagues"
  | "events";

export type NewsLeague =
  | "epl"
  | "laliga"
  | "serie_a"
  | "bundesliga"
  | "ligue_1";

export type WcNewsFeedSource = {
  id: string;
  outlet: string;
  region: WcNewsRegion;
  lang: string;
  url: string;
  category: NewsCategory;
  league?: NewsLeague;
  /** Keep items whose title+summary match (for broad feeds). */
  filter?: RegExp;
  editorialBias?: boolean;
};

export type WcNewsItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  image_url: string | null;
  published_at: string | null;
  outlet: string;
  region: WcNewsRegion;
  lang: string;
  feed_id: string;
  category: NewsCategory;
  league?: NewsLeague;
  editorial_score: number;
  is_editorial: boolean;
};

/** Google News + major outlets — World Cup focus. */
const WC_NEWS_FEEDS_RAW: Omit<WcNewsFeedSource, "category">[] = [
  {
    id: "gn-us-editorial",
    outlet: "Google News",
    region: "US",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial+OR+column+OR+analysis)&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "gn-uk-editorial",
    outlet: "Google News",
    region: "UK",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial+OR+comment)&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-au-editorial",
    outlet: "Google News",
    region: "APAC",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+analysis)&hl=en-AU&gl=AU&ceid=AU:en",
  },
  {
    id: "gn-ca-editorial",
    outlet: "Google News",
    region: "US",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(opinion+OR+editorial)&hl=en-CA&gl=CA&ceid=CA:en",
  },
  {
    id: "gn-de-kommentar",
    outlet: "Google News",
    region: "EU",
    lang: "de",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=WM+2026+(Kommentar+OR+Analyse+OR+Meinung)&hl=de&gl=DE&ceid=DE:de",
  },
  {
    id: "gn-es-opinion",
    outlet: "Google News",
    region: "EU",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis+OR+columna)&hl=es&gl=ES&ceid=ES:es",
  },
  {
    id: "gn-fr-editorial",
    outlet: "Google News",
    region: "EU",
    lang: "fr",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Coupe+du+monde+2026+(opinion+OR+analyse+OR+%C3%A9ditorial)&hl=fr&gl=FR&ceid=FR:fr",
  },
  {
    id: "gn-it-editorial",
    outlet: "Google News",
    region: "EU",
    lang: "it",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mondiale+2026+(opinione+OR+editoriale+OR+analisi)&hl=it&gl=IT&ceid=IT:it",
  },
  {
    id: "gn-br-opiniao",
    outlet: "Google News",
    region: "LATAM",
    lang: "pt",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Copa+do+Mundo+2026+(opini%C3%A3o+OR+an%C3%A1lise+OR+coluna)&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    id: "gn-mx-editorial",
    outlet: "Google News",
    region: "LATAM",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis)&hl=es-419&gl=MX&ceid=MX:es-419",
  },
  {
    id: "gn-ar-editorial",
    outlet: "Google News",
    region: "LATAM",
    lang: "es",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=Mundial+2026+(opini%C3%B3n+OR+an%C3%A1lisis)&hl=es-419&gl=AR&ceid=AR:es-419",
  },
  {
    id: "gn-zh-comment",
    outlet: "Google News",
    region: "APAC",
    lang: "zh",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=%E4%B8%96%E7%95%8C%E6%9D%AF+2026+(%E8%AF%84%E8%AE%BA+OR+%E4%B8%93%E6%A0%8F+OR+%E7%82%B9%E8%AF%84)&hl=zh-CN&gl=CN&ceid=CN:zh-Hans",
  },
  {
    id: "gn-jp-editorial",
    outlet: "Google News",
    region: "APAC",
    lang: "ja",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=%E3%83%AF%E3%83%BC%E3%83%AB%E3%83%89%E3%82%AB%E3%83%83%E3%83%97+2026+%E8%A7%A3%E8%AA%AC&hl=ja&gl=JP&ceid=JP:ja",
  },
  {
    id: "gn-in-analysis",
    outlet: "Google News",
    region: "APAC",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion+OR+column)&hl=en-IN&gl=IN&ceid=IN:en",
  },
  {
    id: "gn-ng-analysis",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion)&hl=en-NG&gl=NG&ceid=NG:en",
  },
  {
    id: "gn-za-analysis",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    editorialBias: true,
    url: "https://news.google.com/rss/search?q=World+Cup+2026+(analysis+OR+opinion)&hl=en-ZA&gl=ZA&ceid=ZA:en",
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

const EXTRA_NEWS_FEEDS: WcNewsFeedSource[] = [
  {
    id: "gn-transfer-uk",
    outlet: "Google News",
    region: "UK",
    lang: "en",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=football+transfer+news+OR+transfer+rumour&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-transfer-us",
    outlet: "Google News",
    region: "US",
    lang: "en",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=soccer+transfer+news&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "sky-transfers",
    outlet: "Sky Sports",
    region: "UK",
    lang: "en",
    category: "transfer",
    url: "https://www.skysports.com/rss/12040",
    filter: /transfer|rummour|rumor|sign|deal|agree|bid/i,
  },
  {
    id: "bbc-football-transfers",
    outlet: "BBC Sport",
    region: "UK",
    lang: "en",
    category: "transfer",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    filter: /transfer|sign|deal|loan|bid|fee|move|join/i,
  },
  {
    id: "guardian-transfers",
    outlet: "The Guardian",
    region: "UK",
    lang: "en",
    category: "transfer",
    url: "https://www.theguardian.com/football/transfers/rss",
  },
  {
    id: "espn-transfer",
    outlet: "ESPN",
    region: "US",
    lang: "en",
    category: "transfer",
    url: "https://www.espn.com/espn/rss/soccer/news",
    filter: /transfer|sign|deal|loan|move|fee/i,
  },
  {
    id: "gn-transfer-es",
    outlet: "Google News",
    region: "EU",
    lang: "es",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=f%C3%BAtbol+fichajes+mercado&hl=es&gl=ES&ceid=ES:es",
  },
  {
    id: "gn-transfer-it",
    outlet: "Google News",
    region: "EU",
    lang: "it",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=calciomercato&hl=it&gl=IT&ceid=IT:it",
  },
  {
    id: "gn-transfer-de",
    outlet: "Google News",
    region: "EU",
    lang: "de",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=Fu%C3%9Fball+Transfer+Ger%C3%BCchte&hl=de&gl=DE&ceid=DE:de",
  },
  {
    id: "gn-transfer-fr",
    outlet: "Google News",
    region: "EU",
    lang: "fr",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=mercato+football+transfert&hl=fr&gl=FR&ceid=FR:fr",
  },
  {
    id: "gn-transfer-global",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    category: "transfer",
    url: "https://news.google.com/rss/search?q=football+transfer+news+when:7d&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-epl-uk",
    outlet: "Google News",
    region: "UK",
    lang: "en",
    category: "epl",
    league: "epl",
    url: "https://news.google.com/rss/search?q=Premier+League+football&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-fpl-fantasy",
    outlet: "Google News",
    region: "UK",
    lang: "en",
    category: "epl",
    league: "epl",
    url: "https://news.google.com/rss/search?q=Fantasy+Premier+League+FPL&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "bbc-epl",
    outlet: "BBC Sport",
    region: "UK",
    lang: "en",
    category: "epl",
    league: "epl",
    url: "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml",
  },
  {
    id: "guardian-football",
    outlet: "The Guardian",
    region: "UK",
    lang: "en",
    category: "epl",
    league: "epl",
    url: "https://www.theguardian.com/football/rss",
    filter: /premier league|fpl|fantasy premier|arsenal|liverpool|manchester|chelsea|tottenham|newcastle|aston villa/i,
  },
  {
    id: "gn-laliga",
    outlet: "Google News",
    region: "EU",
    lang: "en",
    category: "leagues",
    league: "laliga",
    url: "https://news.google.com/rss/search?q=La+Liga+football&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-serie-a",
    outlet: "Google News",
    region: "EU",
    lang: "en",
    category: "leagues",
    league: "serie_a",
    url: "https://news.google.com/rss/search?q=Serie+A+football&hl=en-GB&gl=GB&ceid=GB:en",
  },
  {
    id: "gn-bundesliga",
    outlet: "Google News",
    region: "EU",
    lang: "de",
    category: "leagues",
    league: "bundesliga",
    url: "https://news.google.com/rss/search?q=Bundesliga+Fu%C3%9Fball&hl=de&gl=DE&ceid=DE:de",
  },
  {
    id: "gn-ligue-1",
    outlet: "Google News",
    region: "EU",
    lang: "fr",
    category: "leagues",
    league: "ligue_1",
    url: "https://news.google.com/rss/search?q=Ligue+1+football&hl=fr&gl=FR&ceid=FR:fr",
  },
  {
    id: "gn-football-events",
    outlet: "Google News",
    region: "GLOBAL",
    lang: "en",
    category: "events",
    url: "https://news.google.com/rss/search?q=football+tournament+OR+Champions+League+OR+Euro+2028&hl=en-GB&gl=GB&ceid=GB:en",
  },
];

export const WC_NEWS_FEEDS: WcNewsFeedSource[] = WC_NEWS_FEEDS_RAW.map((f) => ({
  ...f,
  category: "worldcup" as const,
}));

export const NEWS_FEEDS: WcNewsFeedSource[] = [
  ...WC_NEWS_FEEDS,
  ...EXTRA_NEWS_FEEDS,
];

const FETCH_HEADERS = {
  Accept:
    "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
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

function extractImageUrl(block: string, rawSummary: string): string | null {
  const haystacks = [block, rawSummary];
  const patterns = [
    /<media:thumbnail[^>]+url=["']([^"']+)["']/gi,
    /<media:content[^>]+url=["']([^"']+)["'][^>]*(?:medium=["']image|type=["']image)/gi,
    /<media:content[^>]+(?:medium=["']image|type=["']image)[^>]+url=["']([^"']+)["']/gi,
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*["']/gi,
    /<img[^>]+src=["']([^"']+)["']/gi,
  ];

  for (const hay of haystacks) {
    for (const re of patterns) {
      re.lastIndex = 0;
      const m = re.exec(hay);
      const url = m?.[1]?.trim();
      if (url?.startsWith("http")) return url;
    }
  }

  return null;
}

function parseRssItems(xml: string): Array<{
  title: string;
  url: string;
  summary: string;
  image_url: string | null;
  published_at: string | null;
  outlet: string | null;
}> {
  const items: Array<{
    title: string;
    url: string;
    summary: string;
    image_url: string | null;
    published_at: string | null;
    outlet: string | null;
  }> = [];

  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of blocks) {
    const title = stripHtml(extractTag(block, "title"));
    const url = extractLink(block);
    if (!title || !url) continue;

    const rawDesc =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");
    const summary = stripHtml(rawDesc).slice(0, 400);
    const image_url = extractImageUrl(block, rawDesc);

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

    items.push({ title, url, summary, image_url, published_at, outlet });
  }

  if (items.length === 0) {
    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
    for (const block of entries) {
      const title = stripHtml(extractTag(block, "title"));
      const url =
        extractLink(block) ||
        extractTag(block, "id").trim();
      if (!title || !url.startsWith("http")) continue;
      const rawContent =
        extractTag(block, "summary") || extractTag(block, "content");
      const summary = stripHtml(rawContent).slice(0, 400);
      const image_url = extractImageUrl(block, rawContent);
      const pubRaw =
        extractTag(block, "published") || extractTag(block, "updated");
      let published_at: string | null = null;
      if (pubRaw) {
        const ts = Date.parse(pubRaw);
        published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
      }
      items.push({ title, url, summary, image_url, published_at, outlet: null });
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
    const headers: Record<string, string> = { ...FETCH_HEADERS };
    if (url.includes("news.google.com")) {
      headers.Referer = "https://news.google.com/";
    }
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!/<rss|<feed/i.test(text)) return null;
    return text;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

export async function fetchWcNewsItems(opts?: {
  limit?: number;
  editorialOnly?: boolean;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(150, Math.max(20, opts?.limit ?? 100));
  const editorialOnly = opts?.editorialOnly ?? false;

  const { fetchPremierLeagueNewsItems } = await import("@/lib/wc/premierleague-news");
  const { fetchFplXTweets } = await import("@/lib/fpl/fpl-x-feed");
  const [plItems, fplTweetItems] = await Promise.all([
    fetchPremierLeagueNewsItems({ limit: 35 }).catch(() => [] as WcNewsItem[]),
    fetchFplXTweets({ limit: 35 }).catch(() => [] as WcNewsItem[]),
  ]);
  const plBudget = Math.min(plItems.length, 35);
  const fplTweetBudget = Math.min(fplTweetItems.length, 35);
  const rssLimit = Math.max(20, limit - plBudget - fplTweetBudget);

  const batches = await mapWithConcurrency(NEWS_FEEDS, async (feed) => {
      const xml = await fetchFeedXml(feed.url);
      if (!xml) return [] as WcNewsItem[];

      const parsed = parseRssItems(xml);
      const out: WcNewsItem[] = [];

      for (const row of parsed) {
        const text = `${row.title} ${row.summary}`;
        if (feed.filter && !feed.filter.test(text)) continue;
        if (
          feed.category === "worldcup" &&
          !feed.filter &&
          !feed.editorialBias &&
          !WC_RE.test(text)
        )
          continue;

        const score = editorialScore(row.title, row.summary, feed);
        if (editorialOnly && score < 2) continue;

        const outlet = row.outlet || feed.outlet;
        out.push({
          id: `${feed.id}:${dedupeKey(row.title, row.url)}`,
          title: row.title,
          url: row.url,
          summary: row.summary,
          image_url: row.image_url,
          published_at: row.published_at,
          outlet,
          region: feed.region,
          lang: feed.lang,
          feed_id: feed.id,
          category: feed.category,
          league: feed.league,
          editorial_score: score,
          is_editorial: score >= 3,
        });
      }
      return out;
  });

  const seen = new Set<string>();
  const rssMerged: WcNewsItem[] = [];
  for (const item of batches.flat()) {
    const key = dedupeKey(item.title, item.url);
    if (seen.has(key)) continue;
    seen.add(key);
    rssMerged.push(item);
  }

  rssMerged.sort((a, b) => {
    if (b.editorial_score !== a.editorial_score) {
      return b.editorial_score - a.editorial_score;
    }
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  const merged: WcNewsItem[] = [];
  const seenFinal = new Set<string>();
  for (const item of [
    ...plItems,
    ...fplTweetItems,
    ...rssMerged.slice(0, rssLimit),
  ]) {
    const key = dedupeKey(item.title, item.url);
    if (seenFinal.has(key)) continue;
    seenFinal.add(key);
    merged.push(item);
  }

  merged.sort((a, b) => {
    const aPl = a.feed_id === "pl-official" ? 1 : 0;
    const bPl = b.feed_id === "pl-official" ? 1 : 0;
    if (bPl !== aPl) return bPl - aPl;
    const aFplX = a.feed_id === "fpl-x" ? 1 : 0;
    const bFplX = b.feed_id === "fpl-x" ? 1 : 0;
    if (bFplX !== aFplX) return bFplX - aFplX;
    if (b.editorial_score !== a.editorial_score) {
      return b.editorial_score - a.editorial_score;
    }
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  return merged.slice(0, limit);
}
