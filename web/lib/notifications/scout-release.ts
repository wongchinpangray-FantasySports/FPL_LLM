import type { SupabaseClient } from "@supabase/supabase-js";
import { looksLikeChinese } from "@/lib/scout/zh-status";
import {
  insertNotifications,
  type NotificationInsert,
} from "@/lib/notifications/shared";

export const SCOUT_RELEASE_NOTIFY_TYPE = "scout_release";
export const SCOUT_RELEASE_TZ = "Asia/Shanghai";
const INSERT_CHUNK = 80;
const MAX_TITLES = 8;

export type ScoutReleaseArticle = {
  slug: string;
  title_en: string;
  title_zh: string | null;
  excerpt_en: string | null;
  excerpt_zh: string | null;
  pushed_at: string | null;
};

export type ScoutReleaseCopy = {
  title: string;
  body: string;
  href: string;
};

export function shanghaiDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCOUT_RELEASE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Shanghai calendar day as [start, end) in UTC ISO. */
export function shanghaiDayUtcRange(dateIso: string): {
  startIso: string;
  endIso: string;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    throw new Error(`Invalid Shanghai date: ${dateIso}`);
  }
  const start = new Date(`${dateIso}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function scoutReleaseHref(dateIso: string): string {
  return `/scout?released=${dateIso}`;
}

export function scoutReleaseTitleOf(article: ScoutReleaseArticle): string {
  const zh = (article.title_zh ?? "").trim();
  if (looksLikeChinese(zh)) return zh;
  return article.title_en.trim();
}

export function profileNotifyLocale(locale: string | null | undefined): "zh" | "en" {
  return String(locale || "zh").toLowerCase().startsWith("en") ? "en" : "zh";
}

export function buildScoutReleaseCopy(
  articles: ScoutReleaseArticle[],
  locale: "zh" | "en",
  dateIso: string,
): ScoutReleaseCopy {
  const href = scoutReleaseHref(dateIso);
  const titles = articles.map(scoutReleaseTitleOf).filter(Boolean);
  const n = titles.length;
  const listed = titles.slice(0, MAX_TITLES);
  const extra = n > MAX_TITLES ? n - MAX_TITLES : 0;

  if (n === 1) {
    const only = articles[0]!;
    const excerptZh = (only.excerpt_zh ?? "").trim();
    const excerptEn = (only.excerpt_en ?? "").trim();
    if (locale === "en") {
      return {
        title: `New Scout article: ${titles[0]}`,
        body:
          excerptEn ||
          "A new Fantasy Football Scout article is live on Faleague — free to read.",
        href,
      };
    }
    return {
      title: `Scout 中文上新：${titles[0]}`,
      body:
        (looksLikeChinese(excerptZh) ? excerptZh : "") ||
        "Fantasy Football Scout 中文稿已上线，站内免费阅读。",
      href,
    };
  }

  const moreZh = extra > 0 ? `\n另有 ${extra} 篇` : "";
  const moreEn = extra > 0 ? `\n+${extra} more` : "";
  if (locale === "en") {
    return {
      title: `${n} new Scout articles`,
      body: `${listed.join("\n")}${moreEn}\n\nFrom Fantasy Football Scout — free to read on Faleague.`,
      href,
    };
  }
  return {
    title: `Scout 中文上新 · ${n} 篇`,
    body: `${listed.join("\n")}${moreZh}\n\n来自 Fantasy Football Scout，站内免费阅读。`,
    href,
  };
}

export function shanghaiDatesInPushedWindow(
  articles: Pick<ScoutReleaseArticle, "pushed_at">[],
): string[] {
  const dates = new Set<string>();
  for (const a of articles) {
    if (!a.pushed_at) continue;
    const ts = Date.parse(a.pushed_at);
    if (!Number.isFinite(ts)) continue;
    dates.add(shanghaiDateIso(new Date(ts)));
  }
  return [...dates].sort();
}

function isReadableZh(article: {
  title_zh: string | null;
  title_en: string;
}): boolean {
  const zh = (article.title_zh ?? "").trim();
  return looksLikeChinese(zh) && zh !== article.title_en.trim();
}

export async function loadScoutReleasesForShanghaiDay(
  admin: SupabaseClient,
  dateIso: string,
): Promise<ScoutReleaseArticle[]> {
  const { startIso, endIso } = shanghaiDayUtcRange(dateIso);
  const { data, error } = await admin
    .from("scout_articles")
    .select("slug,title_en,title_zh,excerpt_en,excerpt_zh,pushed_at")
    .eq("status", "published")
    .gte("pushed_at", startIso)
    .lt("pushed_at", endIso)
    .order("pushed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScoutReleaseArticle[]).filter(isReadableZh);
}

async function loadProfiles(
  admin: SupabaseClient,
): Promise<Array<{ id: string; locale: string | null }>> {
  const { data, error } = await admin.from("profiles").select("id,locale");
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; locale: string | null }>;
}

async function existingReleaseRows(
  admin: SupabaseClient,
  href: string,
): Promise<Array<{ id: string; user_id: string }>> {
  const { data, error } = await admin
    .from("user_notifications")
    .select("id,user_id")
    .eq("type", SCOUT_RELEASE_NOTIFY_TYPE)
    .eq("href", href);
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; user_id: string }>;
}

async function updateExistingCopy(
  admin: SupabaseClient,
  rows: Array<{ id: string; user_id: string }>,
  localeByUser: Map<string, "zh" | "en">,
  copyZh: ScoutReleaseCopy,
  copyEn: ScoutReleaseCopy,
): Promise<number> {
  const zhIds = rows
    .filter((r) => localeByUser.get(r.user_id) !== "en")
    .map((r) => r.id);
  const enIds = rows
    .filter((r) => localeByUser.get(r.user_id) === "en")
    .map((r) => r.id);
  if (zhIds.length) {
    const { error } = await admin
      .from("user_notifications")
      .update({ title: copyZh.title, body: copyZh.body })
      .in("id", zhIds);
    if (error) throw new Error(error.message);
  }
  if (enIds.length) {
    const { error } = await admin
      .from("user_notifications")
      .update({ title: copyEn.title, body: copyEn.body })
      .in("id", enIds);
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

async function insertChunked(
  admin: SupabaseClient,
  rows: NotificationInsert[],
): Promise<number> {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    inserted += await insertNotifications(admin, rows.slice(i, i + INSERT_CHUNK));
  }
  return inserted;
}

export type NotifyScoutReleaseResult = {
  date: string;
  slugs: string[];
  profiles: number;
  inserted: number;
  updated: number;
  skippedExisting: number;
  dryRun: boolean;
};

export async function notifyScoutArticlesReleased(
  admin: SupabaseClient,
  opts?: {
    dateIso?: string;
    dryRun?: boolean;
    force?: boolean;
    articles?: ScoutReleaseArticle[];
  },
): Promise<NotifyScoutReleaseResult> {
  const dateIso = opts?.dateIso ?? shanghaiDateIso();
  const dryRun = Boolean(opts?.dryRun);
  const force = Boolean(opts?.force);
  const articles =
    opts?.articles ?? (await loadScoutReleasesForShanghaiDay(admin, dateIso));
  const href = scoutReleaseHref(dateIso);

  if (articles.length === 0) {
    return {
      date: dateIso,
      slugs: [],
      profiles: 0,
      inserted: 0,
      updated: 0,
      skippedExisting: 0,
      dryRun,
    };
  }

  const copyZh = buildScoutReleaseCopy(articles, "zh", dateIso);
  const copyEn = buildScoutReleaseCopy(articles, "en", dateIso);
  const profiles = await loadProfiles(admin);

  if (dryRun) {
    return {
      date: dateIso,
      slugs: articles.map((a) => a.slug),
      profiles: profiles.length,
      inserted: 0,
      updated: 0,
      skippedExisting: 0,
      dryRun: true,
    };
  }

  if (force) {
    const { error: delErr } = await admin
      .from("user_notifications")
      .delete()
      .eq("type", SCOUT_RELEASE_NOTIFY_TYPE)
      .eq("href", href);
    if (delErr) throw new Error(delErr.message);
  }

  const existing = force ? [] : await existingReleaseRows(admin, href);
  const already = new Set(existing.map((r) => r.user_id));
  const localeByUser = new Map(
    profiles.map((p) => [p.id, profileNotifyLocale(p.locale)] as const),
  );
  let updated = 0;
  if (existing.length > 0) {
    updated = await updateExistingCopy(
      admin,
      existing,
      localeByUser,
      copyZh,
      copyEn,
    );
  }

  const rows: NotificationInsert[] = [];
  for (const p of profiles) {
    if (already.has(p.id)) continue;
    const locale = profileNotifyLocale(p.locale);
    const copy = locale === "en" ? copyEn : copyZh;
    rows.push({
      user_id: p.id,
      type: SCOUT_RELEASE_NOTIFY_TYPE,
      title: copy.title,
      body: copy.body,
      href,
    });
  }

  const inserted = await insertChunked(admin, rows);
  return {
    date: dateIso,
    slugs: articles.map((a) => a.slug),
    profiles: profiles.length,
    inserted,
    updated,
    skippedExisting: already.size,
    dryRun: false,
  };
}

/** Catch-up: one digest per Shanghai day that has a site publish in the window. */
export async function notifyScoutArticlesSinceHours(
  admin: SupabaseClient,
  opts?: { hours?: number; dryRun?: boolean; force?: boolean },
): Promise<NotifyScoutReleaseResult[]> {
  const hours = opts?.hours ?? 36;
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("scout_articles")
    .select("slug,title_en,title_zh,excerpt_en,excerpt_zh,pushed_at")
    .eq("status", "published")
    .gte("pushed_at", sinceIso)
    .order("pushed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const dates = shanghaiDatesInPushedWindow(
    (data ?? []) as ScoutReleaseArticle[],
  );
  const results: NotifyScoutReleaseResult[] = [];
  for (const dateIso of dates) {
    results.push(
      await notifyScoutArticlesReleased(admin, {
        dateIso,
        dryRun: opts?.dryRun,
        force: opts?.force,
      }),
    );
  }
  return results;
}
