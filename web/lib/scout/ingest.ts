import {
  fetchScoutArticleHtml,
  hasFfsSessionCookie,
  isShorterTeaserVsExisting,
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
import {
  hasRealScoutZh,
  isGeminiNoiseError,
} from "@/lib/scout/zh-status";

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

function hasGeminiKey(): boolean {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim(),
  );
}

type IngestOutcome = {
  outcome: "created" | "updated" | "skipped";
  translationError: string | null;
  truncated: boolean;
  translated: boolean;
};

async function ingestOne(
  item: ScoutRssItem,
  opts: { translate: boolean; force: boolean },
): Promise<IngestOutcome> {
  const existing = await getScoutArticleByGuid(item.guid);
  const fetched = await fetchScoutArticleHtml(item.url, {
    rssContentHtml: item.content_html,
  });
  if (!fetched) {
    throw new Error(`Could not extract article HTML: ${item.url}`);
  }

  const { html: fetchedHtml, images } = sanitizeScoutHtml(fetched.body_html, {
    baseUrl: item.url,
  });
  const keepExistingEn = isShorterTeaserVsExisting(
    fetchedHtml,
    existing?.body_html_en,
    fetched.truncated,
  );
  const body_html_en = keepExistingEn
    ? (existing?.body_html_en ?? fetchedHtml)
    : fetchedHtml;
  const hero =
    keepExistingEn && existing?.hero_image_url
      ? existing.hero_image_url
      : fetched.hero_image_url;
  const allImages = collectImageUrls(body_html_en, hero);
  const excerpt_en = keepExistingEn
    ? existing?.excerpt_en || item.excerpt || excerptFromHtml(body_html_en)
    : item.excerpt || excerptFromHtml(body_html_en);
  const content_hash = hashContent([item.title, body_html_en, hero ?? ""]);
  const existingRealZh = Boolean(existing && hasRealScoutZh(existing));

  const unchanged =
    existing && existing.content_hash === content_hash && !opts.force;
  if (
    unchanged &&
    (!opts.translate ||
      (existingRealZh && !existing?.translation_error))
  ) {
    return {
      outcome: "skipped",
      translationError: null,
      truncated: fetched.truncated || keepExistingEn,
      translated: false,
    };
  }

  const emptyZh = {
    title_zh: "",
    excerpt_zh: null as string | null,
    body_html_zh: null as string | null,
    translation_model: null as string | null,
    translation_error: null as string | null,
    translated_at: null as string | null,
  };

  let title_zh = existingRealZh ? existing!.title_zh : emptyZh.title_zh;
  let excerpt_zh = existingRealZh ? existing!.excerpt_zh : emptyZh.excerpt_zh;
  let body_html_zh = existingRealZh
    ? existing!.body_html_zh
    : emptyZh.body_html_zh;
  let translation_model = existingRealZh
    ? existing!.translation_model
    : emptyZh.translation_model;
  let translation_error = existing?.translation_error ?? null;
  let translated_at = existingRealZh
    ? existing!.translated_at
    : emptyZh.translated_at;
  let didTranslate = false;

  if (opts.translate) {
    const needTranslate =
      opts.force ||
      !existingRealZh ||
      existing?.content_hash !== content_hash ||
      Boolean(existing?.translation_error);
    if (needTranslate && hasGeminiKey()) {
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
        didTranslate = true;
      } catch (e) {
        translation_error = e instanceof Error ? e.message : String(e);
        // Never copy English into ZH on failure.
      }
    } else if (needTranslate && !hasGeminiKey()) {
      translation_error =
        existing?.translation_error ||
        "Missing GEMINI_API_KEY (or GOOGLE_API_KEY)";
    }
  } else if (isGeminiNoiseError(translation_error)) {
    translation_error = null;
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
    preserveZh: existingRealZh && !didTranslate,
  });

  if (translation_error) {
    return {
      outcome: result.created ? "created" : "updated",
      translationError: translation_error,
      truncated: fetched.truncated || keepExistingEn,
      translated: false,
    };
  }
  return {
    outcome: result.created ? "created" : "updated",
    translationError: null,
    truncated: fetched.truncated || keepExistingEn,
    translated: didTranslate,
  };
}

function normUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").split("?")[0]!.toLowerCase();
}

export async function ingestScoutArticles(opts?: {
  pages?: number;
  limit?: number;
  /** Opt-in Gemini. Default is collect English only. */
  translate?: boolean;
  force?: boolean;
  urls?: string[];
}): Promise<ScoutIngestResult> {
  const pages = opts?.pages ?? 1;
  const translate = opts?.translate ?? false;
  const force = opts?.force ?? false;
  const wanted = (opts?.urls ?? []).map(normUrl).filter(Boolean);
  const wantedSet = new Set(wanted);

  let items = await fetchScoutRssItems(pages);
  if (wantedSet.size) {
    const fromRss = items.filter(
      (item) =>
        wantedSet.has(normUrl(item.url)) || wantedSet.has(normUrl(item.guid)),
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
      const { outcome, translationError, truncated, translated } =
        await ingestOne(item, { translate, force });
      result[outcome] += 1;
      if (truncated) result.truncated += 1;
      if (translated) result.translated += 1;
      if (translationError) {
        result.failed += 1;
        result.errors.push(`${item.title}: ${translationError}`);
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
