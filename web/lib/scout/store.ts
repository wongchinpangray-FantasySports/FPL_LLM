import { getServerSupabase } from "@/lib/supabase";
import { sanitizeUtf16 } from "@/lib/utf16-safe";
import type {
  ScoutArticle,
  ScoutArticleListItem,
  ScoutArticleStatus,
  ScoutChannel,
  ScoutDistributionLog,
  ScoutEventInput,
  ScoutImage,
  ScoutSeries,
} from "@/lib/scout/types";

const LIST_COLUMNS =
  "id,slug,source_guid,source_url,title_en,title_zh,excerpt_en,excerpt_zh,author,categories,series,hero_image_url,images,content_hash,status,source_published_at,translated_at,translate_requested_at,pushed_at,translation_model,translation_error,created_at,updated_at";

function sanitizeText(value: string | null | undefined): string {
  return sanitizeUtf16(value ?? "");
}

function asImages(raw: unknown): ScoutImage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const src = sanitizeText((row as ScoutImage).src);
      if (!src) return null;
      return { src, alt: sanitizeText((row as ScoutImage).alt) };
    })
    .filter((x): x is ScoutImage => Boolean(x));
}

function asArticle(row: Record<string, unknown>): ScoutArticle {
  return {
    id: String(row.id),
    slug: sanitizeText(row.slug as string),
    source_guid: sanitizeText(row.source_guid as string),
    source_url: sanitizeText(row.source_url as string),
    title_en: sanitizeText(row.title_en as string),
    title_zh: sanitizeText(row.title_zh as string),
    excerpt_en: row.excerpt_en ? sanitizeText(row.excerpt_en as string) : null,
    excerpt_zh: row.excerpt_zh ? sanitizeText(row.excerpt_zh as string) : null,
    author: row.author ? sanitizeText(row.author as string) : null,
    categories: Array.isArray(row.categories)
      ? (row.categories as string[]).map((c) => sanitizeText(c))
      : [],
    series: (row.series as ScoutSeries) || "other",
    hero_image_url: row.hero_image_url
      ? sanitizeText(row.hero_image_url as string)
      : null,
    images: asImages(row.images),
    body_html_en: row.body_html_en
      ? sanitizeText(row.body_html_en as string)
      : null,
    body_html_zh: row.body_html_zh
      ? sanitizeText(row.body_html_zh as string)
      : null,
    content_hash: row.content_hash ? String(row.content_hash) : null,
    status: (row.status as ScoutArticleStatus) || "pending",
    source_published_at: (row.source_published_at as string | null) ?? null,
    translated_at: (row.translated_at as string | null) ?? null,
    translate_requested_at: (row.translate_requested_at as string | null) ?? null,
    pushed_at: (row.pushed_at as string | null) ?? null,
    translation_model: (row.translation_model as string | null) ?? null,
    translation_error: (row.translation_error as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function asListItem(row: Record<string, unknown>): ScoutArticleListItem {
  const full = asArticle({ ...row, body_html_en: null, body_html_zh: null });
  const { body_html_en: _e, body_html_zh: _z, ...rest } = full;
  return rest;
}

export type ScoutUpsertInput = {
  slug: string;
  source_guid: string;
  source_url: string;
  title_en: string;
  title_zh: string;
  excerpt_en: string | null;
  excerpt_zh: string | null;
  author: string | null;
  categories: string[];
  series: ScoutSeries;
  hero_image_url: string | null;
  images: ScoutImage[];
  body_html_en: string | null;
  body_html_zh: string | null;
  content_hash: string;
  translation_model: string | null;
  translation_error: string | null;
  source_published_at: string | null;
  translated_at: string | null;
  /** When true, leave existing Chinese columns untouched on update. */
  preserveZh?: boolean;
};

export async function listScoutArticles(opts?: {
  status?: ScoutArticleStatus | "all";
  limit?: number;
  series?: ScoutSeries;
}): Promise<ScoutArticleListItem[]> {
  const supa = getServerSupabase();
  const limit = Math.min(200, Math.max(1, opts?.limit ?? 80));
  let q = supa
    .from("scout_articles")
    .select(LIST_COLUMNS)
    .order("source_published_at", { ascending: false })
    .limit(limit);
  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }
  if (opts?.series) q = q.eq("series", opts.series);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(asListItem);
}

export async function listPublishedScoutArticles(
  limit = 40,
): Promise<ScoutArticleListItem[]> {
  return listScoutArticles({ status: "published", limit });
}

export async function getScoutArticleBySlug(
  slug: string,
  opts?: { includeUnpublished?: boolean },
): Promise<ScoutArticle | null> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const article = asArticle(data as Record<string, unknown>);
  if (!opts?.includeUnpublished && article.status !== "published") return null;
  return article;
}

export async function getScoutArticleByGuid(
  guid: string,
): Promise<ScoutArticle | null> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select("*")
    .eq("source_guid", guid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asArticle(data as Record<string, unknown>) : null;
}

export async function getScoutArticleById(
  id: string,
): Promise<ScoutArticle | null> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asArticle(data as Record<string, unknown>) : null;
}

/**
 * Upsert ingest payload. Existing status is preserved — never auto-publish.
 */
export async function upsertScoutIngest(
  input: ScoutUpsertInput,
): Promise<{ id: string; status: ScoutArticleStatus; created: boolean }> {
  const existing = await getScoutArticleByGuid(input.source_guid);
  const now = new Date().toISOString();
  const preserveZh = Boolean(input.preserveZh && existing);
  const payload = JSON.parse(
    JSON.stringify({
      slug: existing?.slug || input.slug,
      source_guid: input.source_guid,
      source_url: input.source_url,
      title_en: sanitizeText(input.title_en),
      excerpt_en: input.excerpt_en ? sanitizeText(input.excerpt_en) : null,
      author: input.author ? sanitizeText(input.author) : null,
      categories: input.categories.map((c) => sanitizeText(c)),
      series: input.series,
      hero_image_url: input.hero_image_url
        ? sanitizeText(input.hero_image_url)
        : null,
      images: input.images,
      body_html_en: input.body_html_en
        ? sanitizeText(input.body_html_en)
        : null,
      content_hash: input.content_hash,
      source_published_at: input.source_published_at,
      updated_at: now,
      ...(preserveZh
        ? { translation_error: input.translation_error }
        : {
            title_zh: sanitizeText(input.title_zh),
            excerpt_zh: input.excerpt_zh
              ? sanitizeText(input.excerpt_zh)
              : null,
            body_html_zh: input.body_html_zh
              ? sanitizeText(input.body_html_zh)
              : null,
            translation_model: input.translation_model,
            translation_error: input.translation_error,
            translated_at: input.translated_at,
          }),
    }),
  ) as Record<string, unknown>;

  const supa = getServerSupabase();
  if (existing) {
    const { error } = await supa
      .from("scout_articles")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { id: existing.id, status: existing.status, created: false };
  }

  const { data, error } = await supa
    .from("scout_articles")
    .insert({
      ...payload,
      title_zh: sanitizeText(input.title_zh),
      excerpt_zh: input.excerpt_zh ? sanitizeText(input.excerpt_zh) : null,
      body_html_zh: input.body_html_zh
        ? sanitizeText(input.body_html_zh)
        : null,
      translation_model: input.translation_model,
      translation_error: input.translation_error,
      translated_at: input.translated_at,
      status: "pending",
      created_at: now,
    })
    .select("id,status")
    .single();
  if (error) throw new Error(error.message);
  return {
    id: String(data.id),
    status: (data.status as ScoutArticleStatus) || "pending",
    created: true,
  };
}

export async function setScoutTranslateRequested(
  ids: string[],
  requested: boolean,
): Promise<number> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return 0;
  const now = new Date().toISOString();
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .update({
      translate_requested_at: requested ? now : null,
      updated_at: now,
    })
    .in("id", unique)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

export async function listScoutTranslateQueue(opts?: {
  slugs?: string[];
}): Promise<ScoutArticle[]> {
  const supa = getServerSupabase();
  let q = supa
    .from("scout_articles")
    .select("*")
    .order("translate_requested_at", { ascending: true, nullsFirst: false })
    .limit(80);
  const slugs = (opts?.slugs ?? []).map((s) => s.trim()).filter(Boolean);
  if (slugs.length) q = q.in("slug", slugs);
  else q = q.not("translate_requested_at", "is", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(asArticle);
}

export async function setScoutArticleStatus(
  id: string,
  status: ScoutArticleStatus,
): Promise<ScoutArticle | null> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
    pushed_at: status === "published" ? now : null,
  };

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? asArticle(data as Record<string, unknown>) : null;
}

export async function insertScoutEvent(
  input: ScoutEventInput,
): Promise<void> {
  const supa = getServerSupabase();
  const { error } = await supa.from("scout_events").insert({
    event_type: input.event_type,
    article_id: input.article_id ?? null,
    slug: input.slug ?? null,
    visitor_id: input.visitor_id ?? null,
    user_id: input.user_id ?? null,
    referrer: input.referrer ? sanitizeText(input.referrer).slice(0, 500) : null,
    path: input.path ? sanitizeText(input.path).slice(0, 300) : null,
    meta: input.meta ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function countScoutByStatus(): Promise<{
  pending: number;
  published: number;
  hidden: number;
}> {
  const supa = getServerSupabase();
  const counts = { pending: 0, published: 0, hidden: 0 };
  await Promise.all(
    (["pending", "published", "hidden"] as const).map(async (status) => {
      const { count, error } = await supa
        .from("scout_articles")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      if (error) throw new Error(error.message);
      counts[status] = count ?? 0;
    }),
  );
  return counts;
}

export async function insertDistributionLog(input: {
  channel: ScoutChannel;
  note?: string | null;
  article_id?: string | null;
  created_by?: string | null;
}): Promise<ScoutDistributionLog> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_distribution_logs")
    .insert({
      channel: input.channel,
      note: input.note ? sanitizeText(input.note) : null,
      article_id: input.article_id ?? null,
      created_by: input.created_by ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ScoutDistributionLog;
}

export async function listDistributionLogs(
  fromIso: string,
  toIso: string,
): Promise<ScoutDistributionLog[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_distribution_logs")
    .select("*")
    .gte("logged_at", fromIso)
    .lt("logged_at", toIso)
    .order("logged_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as ScoutDistributionLog[];
}
