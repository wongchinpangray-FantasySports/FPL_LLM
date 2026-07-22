import type { NewsCategory, WcNewsItem } from "@/lib/wc/news-feeds";

const FEED_ID = "fpl-x";

const FETCH_HEADERS: Record<string, string> = {
  Accept:
    "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

/** Curated X accounts — official + FPL team news, injuries, transfers. */
const FPL_X_ACCOUNTS = [
  { handle: "FantasyPremierLeague", outlet: "FPL Official", alwaysInclude: true },
  { handle: "BenCrellin", outlet: "Ben Crellin", alwaysInclude: false },
  { handle: "FFScout", outlet: "FFScout", alwaysInclude: false },
  { handle: "FPLGeneral", outlet: "FPL General", alwaysInclude: false },
  { handle: "PremierInjury", outlet: "Premier Injuries", alwaysInclude: false },
  { handle: "PhysioRoom", outlet: "PhysioRoom", alwaysInclude: false },
  { handle: "FabrizioRomano", outlet: "Fabrizio Romano", alwaysInclude: false },
  { handle: "David_Ornstein", outlet: "David Ornstein", alwaysInclude: false },
] as const;

const FPL_RE =
  /\bFPL\b|fantasy premier league|gameweek|(?:^|\s)GW\s?\d|deadline|price change|wildcard|bench boost|triple captain|free hit|clean sheet|bonus point|expected points|\bxP\b/i;
const INJURY_RE =
  /injur|doubtful|ruled out|miss(?:es|ing)?|sidelined|scan|hamstring|knock|suspension|ban|available|return(?:s|ed)? to training|team news|fitness|recovered|out for|weeks out/i;
const LINEUP_RE =
  /line-?up|starting(?:\s+eleven| XI| 11)|predicted XI|team news|on the bench|benched|starts? tonight|in the squad|matchday squad|confirmed XI|starting line/i;
const TRANSFER_RE =
  /transfer|sign(?:ing|ed|s)?|loan|bid|deal|move|join|fee|medical|here we go|agreed|target|rumour|rumor|contract extension|release clause/i;
const PL_CONTEXT_RE =
  /premier league|\bEPL\b|\bPL\b|top flight|english top/i;

type SyndicationTweet = {
  __typename?: string;
  id_str?: string;
  text?: string;
  full_text?: string;
  created_at?: string;
  user?: {
    screen_name?: string;
    name?: string;
    profile_image_url_https?: string;
  };
  entities?: {
    media?: Array<{ media_url_https?: string }>;
  };
};

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1]?.trim() ?? "";
}

function extractLink(block: string): string {
  const link = extractTag(block, "link").trim();
  if (link.startsWith("http")) return link;
  const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
}

function parseRssItems(xml: string): Array<{
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
}> {
  const items: Array<{
    title: string;
    url: string;
    summary: string;
    published_at: string | null;
  }> = [];

  for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const title = stripHtml(extractTag(block, "title"));
    const url = extractLink(block);
    if (!title || !url) continue;

    const rawDesc =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");
    const summary = stripHtml(rawDesc).slice(0, 400);

    const pubRaw =
      extractTag(block, "pubDate") ||
      extractTag(block, "published") ||
      extractTag(block, "updated");

    let published_at: string | null = null;
    if (pubRaw) {
      const ts = Date.parse(pubRaw);
      published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
    }

    items.push({ title, url, summary, published_at });
  }

  return items;
}

function tweetStatusUrl(id: string, handle: string): string {
  return `https://x.com/${handle}/status/${id}`;
}

function resolveTweetUrl(rawUrl: string, summary: string): string {
  const haystack = `${rawUrl} ${summary}`;
  const statusMatch = haystack.match(
    /https?:\/\/(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/i,
  );
  if (statusMatch) {
    return tweetStatusUrl(statusMatch[2]!, statusMatch[1]!);
  }
  return rawUrl;
}

function extractTweetId(url: string, summary: string): string | null {
  const haystack = `${url} ${summary}`;
  const m = haystack.match(/\/status\/(\d+)/i);
  return m?.[1] ?? null;
}

function extractHandleFromUrl(url: string): string | null {
  const m = url.match(/(?:x|twitter)\.com\/(\w+)\/status\//i);
  return m?.[1] ?? null;
}

export function isFplRelevantTweet(text: string, alwaysInclude = false): boolean {
  if (alwaysInclude) return true;
  const hay = text.trim();
  if (!hay) return false;
  if (FPL_RE.test(hay)) return true;
  const hasTopic =
    INJURY_RE.test(hay) || LINEUP_RE.test(hay) || TRANSFER_RE.test(hay);
  if (!hasTopic) return false;
  return PL_CONTEXT_RE.test(hay) || TRANSFER_RE.test(hay);
}

function categorizeFplTweet(text: string): NewsCategory {
  if (TRANSFER_RE.test(text)) return "transfer";
  return "epl";
}

export type FplXTopic = "all" | "injury" | "lineup" | "transfer";

export function matchesFplXTopic(text: string, topic: FplXTopic): boolean {
  if (topic === "all") return true;
  if (topic === "injury") return INJURY_RE.test(text);
  if (topic === "lineup") return LINEUP_RE.test(text);
  if (topic === "transfer") return TRANSFER_RE.test(text);
  return true;
}

export function filterFplXItems(
  items: WcNewsItem[],
  topic: FplXTopic,
): WcNewsItem[] {
  if (topic === "all") return items;
  return items.filter((item) =>
    matchesFplXTopic(`${item.title} ${item.summary}`, topic),
  );
}

function mapSyndicationTweet(
  tweet: SyndicationTweet,
  source: { outlet: string; alwaysInclude: boolean },
): WcNewsItem | null {
  if (tweet.__typename === "TweetTombstone" || !tweet.id_str?.trim()) {
    return null;
  }

  const text = (tweet.full_text ?? tweet.text ?? "").trim();
  if (!text || !isFplRelevantTweet(text, source.alwaysInclude)) return null;

  const handle = tweet.user?.screen_name?.trim() || "i";
  const mediaUrl = tweet.entities?.media?.[0]?.media_url_https ?? null;
  const avatar = tweet.user?.profile_image_url_https ?? null;

  let published_at: string | null = null;
  if (tweet.created_at) {
    const ts = Date.parse(tweet.created_at);
    published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }

  const title =
    text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;

  return {
    id: `${FEED_ID}:${tweet.id_str}`,
    title,
    url: tweetStatusUrl(tweet.id_str, handle),
    summary: text,
    image_url: mediaUrl ?? avatar,
    published_at,
    outlet: source.outlet,
    region: "UK",
    lang: "en",
    feed_id: FEED_ID,
    category: categorizeFplTweet(text),
    league: "epl",
    editorial_score: 0,
    is_editorial: false,
  };
}

async function fetchSyndicationProfile(
  handle: string,
  perAccount: number,
): Promise<SyndicationTweet[]> {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          ...FETCH_HEADERS,
          Accept: "text/html,application/xhtml+xml",
          Referer: "https://platform.twitter.com/",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 2500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return [];

      const html = await res.text();
      const m = html.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
      );
      if (!m?.[1]) return [];

      const data = JSON.parse(m[1]) as {
        props?: {
          pageProps?: {
            timeline?: {
              entries?: Array<{ content?: { tweet?: SyndicationTweet } }>;
            };
          };
        };
      };

      const entries = data.props?.pageProps?.timeline?.entries ?? [];
      const out: SyndicationTweet[] = [];
      for (const entry of entries) {
        const tweet = entry.content?.tweet;
        if (tweet) out.push(tweet);
        if (out.length >= perAccount) break;
      }
      return out;
    } catch {
      if (attempt === 1) return [];
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return [];
}

async function fetchSyndicationTweets(limit: number): Promise<WcNewsItem[]> {
  const perAccount = Math.max(3, Math.ceil(limit / FPL_X_ACCOUNTS.length));
  const out: WcNewsItem[] = [];

  for (let i = 0; i < FPL_X_ACCOUNTS.length; i++) {
    const account = FPL_X_ACCOUNTS[i]!;
    const tweets = await fetchSyndicationProfile(account.handle, perAccount);
    for (const tweet of tweets) {
      const item = mapSyndicationTweet(tweet, account);
      if (item) out.push(item);
    }
    if (i < FPL_X_ACCOUNTS.length - 1) {
      await new Promise((r) => setTimeout(r, 800));
    }
  }

  return out;
}

function parseRssUrls(): string[] {
  const urls: string[] = [];
  const multi = process.env.FPL_X_RSS_URLS?.trim();
  if (multi) {
    urls.push(
      ...multi
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean),
    );
  }
  const single = process.env.FPL_X_RSS_URL?.trim();
  if (single) urls.push(single);
  const fallback = process.env.FPL_X_RSS_FALLBACK_URL?.trim();
  if (fallback) urls.push(fallback);
  return [...new Set(urls)];
}

async function fetchRssTweets(rssUrl: string, limit: number): Promise<WcNewsItem[]> {
  try {
    const res = await fetch(rssUrl, {
      headers: FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    if (!/<rss|<feed/i.test(xml)) return [];

    const out: WcNewsItem[] = [];
    for (const row of parseRssItems(xml)) {
      const url = resolveTweetUrl(row.url, row.summary);
      const tweetId = extractTweetId(url, row.summary);
      const title = row.title.trim();
      if (!title || !tweetId) continue;

      const handle = extractHandleFromUrl(url) ?? "i";
      const text = row.summary || title;
      if (!isFplRelevantTweet(text)) continue;

      const account = FPL_X_ACCOUNTS.find(
        (a) => a.handle.toLowerCase() === handle.toLowerCase(),
      );

      out.push({
        id: `${FEED_ID}:${tweetId}`,
        title: title.length > 140 ? `${title.slice(0, 137).trim()}…` : title,
        url: tweetStatusUrl(tweetId, handle),
        summary: text,
        image_url: null,
        published_at: row.published_at,
        outlet: account?.outlet ?? `@${handle}`,
        region: "UK",
        lang: "en",
        feed_id: FEED_ID,
        category: categorizeFplTweet(text),
        league: "epl",
        editorial_score: 0,
        is_editorial: false,
      });
      if (out.length >= limit) break;
    }

    return out;
  } catch {
    return [];
  }
}

function dedupeFplTweets(items: WcNewsItem[]): WcNewsItem[] {
  const seen = new Set<string>();
  const out: WcNewsItem[] = [];
  for (const item of items) {
    const tweetId = item.id.replace(`${FEED_ID}:`, "");
    const key = tweetId || item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });
}

/** FPL-related X posts: official account + injuries, line-ups, transfers (GitHub Actions sync). */
export async function fetchFplXTweets(opts?: {
  limit?: number;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(30, Math.max(5, opts?.limit ?? 20));

  const syndication = await fetchSyndicationTweets(limit);

  const rssUrls = parseRssUrls();
  const rssBatches = await Promise.all(
    rssUrls.map((url) => fetchRssTweets(url, limit)),
  );

  return dedupeFplTweets([...syndication, ...rssBatches.flat()]).slice(0, limit);
}

/** @deprecated Use fetchFplXTweets */
export const fetchFplOfficialTweets = fetchFplXTweets;
