import type { NewsCategory, WcNewsItem } from "@/lib/wc/news-feeds";

const PL_API = "https://api.premierleague.com";
const PL_SITE = "https://www.premierleague.com";

const PL_HEADERS: Record<string, string> = {
  Accept: "application/json",
  Origin: PL_SITE,
  Referer: `${PL_SITE}/en/news`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "X-Pulse-Application-Name": "web",
  "X-Pulse-Application-Version": "v1.48.0",
};

/** Official PL news page playlists (premierleague.com/en/news). */
const PL_NEWS_PLAYLISTS = [
  { id: 4406258, label: "Latest News & Features" },
  { id: 4406257, label: "Match Reports" },
] as const;

type PlTag = { id: number; label: string };

type PlArticle = {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  summary?: string | null;
  date?: string | null;
  titleUrlSegment?: string | null;
  imageUrl?: string | null;
  tags?: PlTag[];
};

type PlPlaylistResponse = {
  items?: Array<{ id: number; type: string; response?: PlArticle }>;
};

type PlMultiResponse = {
  content?: PlArticle[];
};

const TRANSFER_RE =
  /transfer|sign(?:ing|ed|s)?|deal|loan|bid|fee|move|join|rummour|rumor|mercato|fichaje/i;
const WC_RE =
  /world cup|worldcup|fifa world cup|wm 2026|mundial 2026|coupe du monde 2026|mondiale 2026|copa do mundo 2026|\bworld cup 2026\b/i;
const SEASON_RE = /20\d{2}\/\d{2}/;
const BRIEFING_DESC_RE =
  /^our round-up of news stories and transfer reports across the premier league\.?$/i;

function categorizePlArticle(article: PlArticle): NewsCategory {
  const title = article.title ?? "";
  const rawSummary = (article.description ?? article.summary ?? "").trim();
  const summary =
    rawSummary && !BRIEFING_DESC_RE.test(rawSummary) ? rawSummary : "";
  const text = `${title} ${summary}`.trim();
  const tagText = (article.tags ?? []).map((t) => t.label).join(" ");

  if (TRANSFER_RE.test(title) || TRANSFER_RE.test(`${title} ${summary}`)) {
    return "transfer";
  }
  if (
    !SEASON_RE.test(title) &&
    !SEASON_RE.test(summary) &&
    (WC_RE.test(text) || WC_RE.test(tagText))
  ) {
    return "worldcup";
  }
  return "epl";
}

function articleUrl(article: PlArticle): string {
  const slug = article.titleUrlSegment?.trim() || "article";
  return `${PL_SITE}/en/news/${article.id}/${slug}`;
}

function mapPlArticle(article: PlArticle): WcNewsItem | null {
  if (article.type !== "text" || !article.title?.trim()) return null;

  const category = categorizePlArticle(article);
  const summary = (article.description ?? article.summary ?? "").trim().slice(0, 400);
  let published_at: string | null = null;
  if (article.date) {
    const ts = Date.parse(article.date);
    published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }

  const url = articleUrl(article);
  return {
    id: `pl-official:${article.id}`,
    title: article.title.trim(),
    url,
    summary,
    image_url: article.imageUrl?.trim() || null,
    published_at,
    outlet: "Premier League",
    region: "UK",
    lang: "en",
    feed_id: "pl-official",
    category,
    league: "epl",
    editorial_score: 0,
    is_editorial: false,
  };
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

async function fetchPlaylistArticles(
  playlistId: number,
  pageSize: number,
): Promise<WcNewsItem[]> {
  const data = await fetchPlJson<PlPlaylistResponse>(
    `/content/premierleague/playlist/en/${playlistId}?detail=DETAILED&pageSize=${pageSize}&page=0`,
  );
  if (!data?.items?.length) return [];

  const out: WcNewsItem[] = [];
  for (const row of data.items) {
    const article = row.response;
    if (!article) continue;
    const mapped = mapPlArticle(article);
    if (mapped) out.push(mapped);
  }
  return out;
}

async function fetchLatestArticles(limit: number): Promise<WcNewsItem[]> {
  const data = await fetchPlJson<PlMultiResponse>(
    `/content/premierleague/en?contentTypes=TEXT&offset=0&limit=${limit}&onlyRestrictedContent=false&detail=DETAILED`,
  );
  if (!data?.content?.length) return [];

  const out: WcNewsItem[] = [];
  for (const article of data.content) {
    const mapped = mapPlArticle(article);
    if (mapped) out.push(mapped);
  }
  return out;
}

function dedupePlItems(items: WcNewsItem[]): WcNewsItem[] {
  const seen = new Set<string>();
  const out: WcNewsItem[] = [];
  for (const item of items) {
    const key = item.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Official headlines from premierleague.com (Pulse content API). */
export async function fetchPremierLeagueNewsItems(opts?: {
  limit?: number;
}): Promise<WcNewsItem[]> {
  const limit = Math.min(40, Math.max(10, opts?.limit ?? 30));

  const batches = await Promise.all([
    ...PL_NEWS_PLAYLISTS.map((p) => fetchPlaylistArticles(p.id, 15)),
    fetchLatestArticles(15),
  ]);

  const merged = dedupePlItems(batches.flat());
  merged.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });

  return merged.slice(0, limit);
}
