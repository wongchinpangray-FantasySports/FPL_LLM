import {
  fetchScoutArticleHtml,
  hasFfsSessionCookie,
  scoutRssItemFromWpUrl,
} from "@/lib/scout/fetch-article";
import {
  collectImageUrls,
  excerptFromHtml,
  hashContent,
  sanitizeScoutHtml,
  seriesFromCategories,
  slugFromSourceUrl,
} from "@/lib/scout/html";
import { fetchScoutRssItems } from "@/lib/scout/rss";
import {
  getScoutArticleByGuid,
  upsertScoutIngest,
} from "@/lib/scout/store";
import { translateScoutArticle } from "@/lib/scout/translate";
import type { ScoutRssItem } from "@/lib/scout/types";

export type ScoutIngestResult = {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  translated: number;
  failed: number;
  truncated: number;
  authenticated: boolean;
  errors: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type IngestOutcome = {
  outcome: "created" | "updated" | "skipped";
  translationError: string | null;
  truncated: boolean;
};

async function ingestOne(
  item: ScoutRssItem,
  opts: { forceTranslate: boolean },
): Promise<IngestOutcome> {
  const existing = await getScoutArticleByGuid(item.guid);
  const fetched = await fetchScoutArticleHtml(item.url, {
    rssContentHtml: item.content_html,
  });
  if (!fetched) {
    throw new Error(`Could not extract article HTML: ${item.url}`);
  }

  const { html: body_html_en, images } = sanitizeScoutHtml(fetched.body_html, {
    baseUrl: item.url,
  });
  const hero = fetched.hero_image_url;
  const allImages = collectImageUrls(body_html_en, hero);
  const excerpt_en =
    item.excerpt || excerptFromHtml(body_html_en);
  const content_hash = hashContent([
    item.title,
    body_html_en,
    hero ?? "",
  ]);

  const unchanged =
    existing &&
    existing.content_hash === content_hash &&
    existing.body_html_zh &&
    !existing.translation_error;
  if (unchanged && !opts.forceTranslate) {
    return {
      outcome: "skipped",
      translationError: null,
      truncated: fetched.truncated,
    };
  }

  let title_zh = existing?.title_zh || item.title;
  let excerpt_zh = existing?.excerpt_zh || excerpt_en;
  let body_html_zh = existing?.body_html_zh || body_html_en;
  let translation_model = existing?.translation_model ?? null;
  let translation_error: string | null = null;
  let translated_at = existing?.translated_at ?? null;

  const needTranslate =
    (opts.forceTranslate ||
      !existing?.body_html_zh ||
      existing.content_hash !== content_hash ||
      Boolean(existing.translation_error)) &&
    Boolean(
      process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
    );

  if (
    !needTranslate &&
    !(process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim())
  ) {
    translation_error =
      existing?.translation_error ||
      "Missing GEMINI_API_KEY (or GOOGLE_API_KEY)";
  }

  if (needTranslate) {
    try {
      const zh = await translateScoutArticle({
        title_en: item.title,
        excerpt_en,
        body_html_en,
      });
      title_zh = zh.title_zh;
      excerpt_zh = zh.excerpt_zh || excerptFromHtml(zh.body_html_zh);
      body_html_zh = zh.body_html_zh;
      translation_model = zh.model;
      translated_at = new Date().toISOString();
      translation_error = null;
    } catch (e) {
      translation_error = e instanceof Error ? e.message : String(e);
      if (!existing?.body_html_zh) {
        body_html_zh = body_html_en;
        title_zh = item.title;
      }
    }
  }

  const result = await upsertScoutIngest({
    slug: slugFromSourceUrl(item.url, item.guid),
    source_guid: item.guid,
    source_url: item.url,
    title_en: item.title,
    title_zh,
    excerpt_en,
    excerpt_zh,
    author: item.author,
    categories: item.categories,
    series: seriesFromCategories(item.categories),
    hero_image_url: hero,
    images: allImages.length ? allImages : images,
    body_html_en,
    body_html_zh,
    content_hash,
    translation_model,
    translation_error,
    source_published_at: item.published_at,
    translated_at,
  });

  if (translation_error) {
    return {
      outcome: result.created ? "created" : "updated",
      translationError: translation_error,
      truncated: fetched.truncated,
    };
  }
  return {
    outcome: result.created ? "created" : "updated",
    translationError: null,
    truncated: fetched.truncated,
  };
}

function normUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").split("?")[0]!.toLowerCase();
}

export async function ingestScoutArticles(opts?: {
  pages?: number;
  limit?: number;
  forceTranslate?: boolean;
  urls?: string[];
}): Promise<ScoutIngestResult> {
  const pages = opts?.pages ?? 1;
  const forceTranslate = opts?.forceTranslate ?? false;
  const wanted = (opts?.urls ?? [])
    .map(normUrl)
    .filter(Boolean);
  const wantedSet = new Set(wanted);

  let items = await fetchScoutRssItems(pages);
  if (wantedSet.size) {
    const fromRss = items.filter(
      (item) => wantedSet.has(normUrl(item.url)) || wantedSet.has(normUrl(item.guid)),
    );
    const missing = wanted.filter(
      (u) =>
        !fromRss.some(
          (item) => normUrl(item.url) === u || normUrl(item.guid) === u,
        ),
    );
    const extras: ScoutRssItem[] = [];
    for (const url of missing) {
      const fromWp = await scoutRssItemFromWpUrl(url);
      extras.push(
        fromWp ?? {
          title: url,
          url,
          guid: url,
          excerpt: "",
          author: null,
          published_at: null,
          categories: [],
        },
      );
    }
    items = [...fromRss, ...extras];
  }

  const sliced = items.slice(0, opts?.limit ?? items.length);

  const result: ScoutIngestResult = {
    fetched: sliced.length,
    created: 0,
    updated: 0,
    skipped: 0,
    translated: 0,
    failed: 0,
    truncated: 0,
    authenticated: hasFfsSessionCookie(),
    errors: [],
  };

  for (const item of sliced) {
    try {
      const { outcome, translationError, truncated } = await ingestOne(item, {
        forceTranslate,
      });
      result[outcome] += 1;
      if (truncated) result.truncated += 1;
      if (translationError) {
        result.failed += 1;
        result.errors.push(`${item.title}: ${translationError}`);
      } else if (outcome === "created" || outcome === "updated") {
        result.translated += 1;
      }
    } catch (e) {
      result.failed += 1;
      result.errors.push(
        `${item.title}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    await sleep(400);
  }

  return result;
}
