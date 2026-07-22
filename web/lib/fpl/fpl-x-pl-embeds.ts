import type { WcNewsItem } from "@/lib/wc/news-feeds";
import {
  isFplRelevantTweet,
  isFplXWithinWeek,
  resolveFplXAccount,
} from "@/lib/fpl/fpl-x-feed";

const PL_API = "https://api.premierleague.com";
const PL_SITE = "https://www.premierleague.com";
const FEED_ID = "fpl-x";

const PL_HEADERS: Record<string, string> = {
  Accept: "application/json",
  Origin: PL_SITE,
  Referer: `${PL_SITE}/en/news`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "X-Pulse-Application-Name": "web",
  "X-Pulse-Application-Version": "v1.48.0",
};

const FPL_ARTICLE_RE =
  /\bfpl\b|fantasy|fantasy premier league|fantasy football|mini-league|gameweek|\bgw\s?\d/i;

type PlArticleListItem = {
  id: number;
  type: string;
  title?: string | null;
  description?: string | null;
  summary?: string | null;
  date?: string | null;
  titleUrlSegment?: string | null;
  imageUrl?: string | null;
};

type PlArticleBody = PlArticleListItem & {
  body?: string | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTweetDate(raw: string | null): string | null {
  if (!raw) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

function parseBlockquoteDate(block: string): string | null {
  const m = block.match(
    /(?:twitter\.com|x\.com)\/\w+\/status\/\d+[^>]*>([A-Za-z]+ \d{1,2}, \d{4})</,
  );
  if (m?.[1]) return parseTweetDate(m[1]);
  const plain = block.match(/>\s*([A-Za-z]+ \d{1,2}, \d{4})\s*</);
  return plain?.[1] ? parseTweetDate(plain[1]) : null;
}

function parseTweetEmbedsFromBody(
  body: string,
  article: PlArticleListItem,
): WcNewsItem[] {
  const blocks =
    body.match(/<blockquote class="twitter-tweet"[\s\S]*?<\/blockquote>/gi) ??
    [];
  const out: WcNewsItem[] = [];

  for (const block of blocks) {
    const statusMatch =
      block.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d{10,})/i) ??
      block.match(/status\/(\d{10,})/i);
    const tweetId = statusMatch?.[1];
    if (!tweetId) continue;

    const handleMatch =
      block.match(/(?:twitter\.com|x\.com)\/(\w+)\/status/i) ??
      block.match(/@([A-Za-z0-9_]+)\)/);
    const handle = handleMatch?.[1] ?? "OfficialFPL";

    const paragraph = block.match(/<p[^>]*dir="ltr"[^>]*>([\s\S]*?)<\/p>/i);
    const text = stripHtml(paragraph?.[1] ?? "").slice(0, 400);
    if (!text) continue;

    const account = resolveFplXAccount(handle);
    if (!account && !isFplRelevantTweet(text)) continue;

    const published_at =
      parseBlockquoteDate(block) ?? parseTweetDate(article.date ?? null);

    out.push({
      id: `${FEED_ID}:${tweetId}`,
      title: text.length > 140 ? `${text.slice(0, 137).trim()}…` : text,
      url: `https://x.com/${handle}/status/${tweetId}`,
      summary: text,
      image_url: article.imageUrl?.trim() || null,
      published_at,
      outlet: account?.outlet ?? `@${handle}`,
      region: "UK",
      lang: "en",
      feed_id: FEED_ID,
      category: "epl",
      league: "epl",
      editorial_score: 0,
      is_editorial: false,
    });
  }

  return out;
}

async function fetchPlJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${PL_API}${path}`, {
      headers: PL_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isFplArticle(article: PlArticleListItem): boolean {
  const text = `${article.title ?? ""} ${article.description ?? ""} ${article.summary ?? ""}`;
  return FPL_ARTICLE_RE.test(text);
}

function articlePriority(article: PlArticleListItem): number {
  return isFplArticle(article) ? 0 : 1;
}

/** Official @OfficialFPL posts embedded on premierleague.com FPL articles. */
export async function fetchFplXFromPlEmbeds(opts?: {
  limit?: number;
  weekOnly?: boolean;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(25, Math.max(3, opts?.limit ?? 15));
  const weekOnly = opts?.weekOnly ?? true;

  const pages = await Promise.all([
    fetchPlJson<{ content?: PlArticleListItem[] }>(
      `/content/premierleague/en?contentTypes=TEXT&offset=0&limit=100&onlyRestrictedContent=false&detail=DETAILED`,
    ),
    fetchPlJson<{ content?: PlArticleListItem[] }>(
      `/content/premierleague/en?contentTypes=TEXT&offset=100&limit=50&onlyRestrictedContent=false&detail=DETAILED`,
    ),
  ]);

  const candidates = pages
    .flatMap((list) => list?.content ?? [])
    .filter((a) => a.type === "text")
    .sort(
      (a, b) =>
        articlePriority(a) - articlePriority(b) ||
        Date.parse(b.date ?? "") - Date.parse(a.date ?? ""),
    )
    .slice(0, 24);

  const bodies = await Promise.all(
    candidates.map(async (article) => {
      const full = await fetchPlJson<PlArticleBody>(
        `/content/premierleague/text/en/${article.id}`,
      );
      return full ?? article;
    }),
  );

  const seen = new Set<string>();
  const out: WcNewsItem[] = [];

  for (const article of bodies as PlArticleBody[]) {
    const body = article.body ?? "";
    if (!body.includes("twitter-tweet")) continue;
    for (const item of parseTweetEmbedsFromBody(body, article)) {
      const key = item.id.replace(`${FEED_ID}:`, "");
      if (seen.has(key)) continue;
      if (weekOnly && !isFplXWithinWeek(item.published_at)) continue;
      seen.add(key);
      out.push(item);
    }
  }

  return out
    .sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    })
    .slice(0, limit);
}
