import {
  extractHtmlByClass,
  extractOgImage,
  sanitizeScoutHtml,
} from "@/lib/scout/html";
import { FFS_SITE_URL } from "@/lib/scout/links";
import type { ScoutRssItem } from "@/lib/scout/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const PAYWALL_RE = /requires a Fantasy Football Scout user account/i;

/** After the paywall sentence, this much remaining text means the body is still a teaser. */
const TEASER_AFTER_PAYWALL_CHARS = 400;

export type ScoutFetchedArticle = {
  body_html: string;
  hero_image_url: string | null;
  truncated: boolean;
  source: "html" | "rest" | "rss";
};

export function normalizeFfsCookieHeader(raw: string): string {
  return raw.replace(/^Cookie:\s*/i, "").trim();
}

/** True when FFS_SESSION_COOKIE or FFS_AUTH_COOKIE is non-empty. Never log the value. */
export function hasFfsSessionCookie(): boolean {
  return Boolean(readFfsSessionCookie());
}

export function readFfsSessionCookie(): string | null {
  const raw = (
    process.env.FFS_SESSION_COOKIE ||
    process.env.FFS_AUTH_COOKIE ||
    ""
  ).trim();
  const cookie = normalizeFfsCookieHeader(raw);
  return cookie || null;
}

export function buildFfsFetchHeaders(opts?: {
  accept?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: opts?.accept ?? "text/html,application/xhtml+xml",
    "User-Agent": UA,
    Referer: `${FFS_SITE_URL}/`,
  };
  const cookie = readFfsSessionCookie();
  if (cookie) headers.Cookie = cookie;
  return headers;
}

export function articleSlugFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop() ?? "";
    return last || null;
  } catch {
    return null;
  }
}

export function wpPostsBySlugUrl(articleUrl: string, contextEdit = false): string | null {
  const slug = articleSlugFromUrl(articleUrl);
  if (!slug) return null;
  const u = new URL(`${FFS_SITE_URL}/wp-json/wp/v2/posts`);
  u.searchParams.set("slug", slug);
  u.searchParams.set("_embed", "1");
  u.searchParams.set("per_page", "1");
  if (contextEdit) u.searchParams.set("context", "edit");
  return u.toString();
}

export function stripScoutPaywallBanner(html: string): string {
  return html.replace(
    /[\s\S]{0,80}requires a Fantasy Football Scout user account[\s\S]{0,400}/i,
    "",
  );
}

export function isTruncatedScoutTeaser(html: string): boolean {
  if (!PAYWALL_RE.test(html)) return false;
  const idx = html.search(PAYWALL_RE);
  const after = idx >= 0 ? html.slice(idx) : html;
  return stripLen(stripScoutPaywallBanner(after)) < TEASER_AFTER_PAYWALL_CHARS;
}

export function stripLen(html: string): number {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}

type BodyCandidate = {
  raw: string;
  hero: string | null;
  source: ScoutFetchedArticle["source"];
};

function toFetched(candidate: BodyCandidate, baseUrl: string): ScoutFetchedArticle | null {
  const truncated = isTruncatedScoutTeaser(candidate.raw);
  const cleaned = truncated
    ? stripScoutPaywallBanner(candidate.raw)
    : PAYWALL_RE.test(candidate.raw)
      ? stripScoutPaywallBanner(candidate.raw)
      : candidate.raw;
  const { html: body_html } = sanitizeScoutHtml(cleaned, { baseUrl });
  if (stripLen(body_html) < 80) return null;
  return {
    body_html,
    hero_image_url: candidate.hero,
    truncated,
    source: candidate.source,
  };
}

function better(a: ScoutFetchedArticle | null, b: ScoutFetchedArticle | null): ScoutFetchedArticle | null {
  if (!a) return b;
  if (!b) return a;
  if (a.truncated !== b.truncated) return a.truncated ? b : a;
  return stripLen(b.body_html) > stripLen(a.body_html) ? b : a;
}

type WpPost = {
  id?: number;
  guid?: { rendered?: string };
  slug?: string;
  link?: string;
  date_gmt?: string;
  title?: { rendered?: string };
  content?: { rendered?: string; raw?: string; protected?: boolean };
  excerpt?: { rendered?: string };
  _embedded?: {
    author?: Array<{ name?: string }>;
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
    "wp:term"?: Array<Array<{ name?: string; taxonomy?: string }>>;
  };
};

function wpContentHtml(post: WpPost): string {
  return (post.content?.raw || post.content?.rendered || "").trim();
}

function wpHero(post: WpPost): string | null {
  const src = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url?.trim();
  return src?.startsWith("http") ? src.split("?")[0] ?? src : null;
}

async function fetchText(
  url: string,
  accept: string,
  timeoutMs = 18_000,
): Promise<string | null> {
  const res = await fetch(url, {
    headers: buildFfsFetchHeaders({ accept }),
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  return res.text();
}

export async function fetchWpPostJson(articleUrl: string): Promise<WpPost | null> {
  const urls = [
    wpPostsBySlugUrl(articleUrl, Boolean(readFfsSessionCookie())),
    wpPostsBySlugUrl(articleUrl, false),
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  for (const endpoint of urls) {
    try {
      const text = await fetchText(
        endpoint,
        "application/json",
        18_000,
      );
      if (!text) continue;
      const parsed = JSON.parse(text) as unknown;
      const post = Array.isArray(parsed) ? (parsed[0] as WpPost | undefined) : (parsed as WpPost);
      if (post && (wpContentHtml(post) || post.title?.rendered)) return post;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function scoutRssItemFromWpUrl(
  url: string,
): Promise<ScoutRssItem | null> {
  const post = await fetchWpPostJson(url);
  if (!post) return null;
  const title = (post.title?.rendered || "").replace(/<[^>]+>/g, "").trim();
  const link = post.link?.trim() || url;
  const guid = post.guid?.rendered?.trim() || (post.id ? `${FFS_SITE_URL}/?p=${post.id}` : link);
  const excerpt = (post.excerpt?.rendered || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const author = post._embedded?.author?.[0]?.name?.trim() || null;
  const terms = (post._embedded?.["wp:term"] ?? []).flat();
  const categories = terms
    .filter((t) => t?.name && (t.taxonomy === "category" || t.taxonomy === "post_tag"))
    .map((t) => String(t.name));
  let published_at: string | null = null;
  if (post.date_gmt) {
    const ts = Date.parse(post.date_gmt.endsWith("Z") ? post.date_gmt : `${post.date_gmt}Z`);
    published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  if (!title) return null;
  return {
    title,
    url: link,
    guid,
    excerpt,
    author,
    published_at,
    categories,
    content_html: wpContentHtml(post) || null,
  };
}

export async function fetchScoutArticleHtml(
  url: string,
  opts?: { rssContentHtml?: string | null },
): Promise<ScoutFetchedArticle | null> {
  try {
    const htmlP = fetchText(url, "text/html,application/xhtml+xml");
    const wpP = fetchWpPostJson(url);
    const [html, post] = await Promise.all([htmlP, wpP]);

    let best: ScoutFetchedArticle | null = null;

    if (html) {
      const raw =
        extractHtmlByClass(html, "entry-content") ??
        extractHtmlByClass(html, "post-content") ??
        extractHtmlByClass(html, "article-content");
      if (raw && stripLen(raw) >= 80) {
        best = better(
          best,
          toFetched({ raw, hero: extractOgImage(html), source: "html" }, url),
        );
      }
    }

    if (post) {
      const raw = wpContentHtml(post);
      if (stripLen(raw) >= 80) {
        best = better(
          best,
          toFetched(
            {
              raw,
              hero: wpHero(post) ?? best?.hero_image_url ?? null,
              source: "rest",
            },
            url,
          ),
        );
      }
    }

    const rssHtml = opts?.rssContentHtml?.trim() || "";
    if (stripLen(rssHtml) >= 80) {
      best = better(
        best,
        toFetched(
          { raw: rssHtml, hero: best?.hero_image_url ?? null, source: "rss" },
          url,
        ),
      );
    }

    if (best && !best.hero_image_url && html) {
      best = { ...best, hero_image_url: extractOgImage(html) };
    }
    return best;
  } catch {
    return null;
  }
}
