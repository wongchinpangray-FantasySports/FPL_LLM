/**
 * Xiaohongshu carousel helpers for translated Scout articles.
 * Pure (no Playwright / no Supabase). Used by scripts/scout-xhs-pages.ts.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sanitizeScoutHtml, stripTags } from "./html";
import { looksLikeChinese } from "./zh-status";

export const XHS_WIDTH = 1080;
export const XHS_HEIGHT = 1440;
export const DEFAULT_LATEST = 8;
export const DEFAULT_DAYS = 5;
export const MAX_PAGES = 18;
export const TEASER_MAX_ARTICLES = 4;
/** Extra ZH titles on the closing page (not in this carousel). */
export const CLOSE_MORE_MAX = 8;
/** Fallback body blocks when `summary_zh` is missing. Prefer a written summary. */
export const TEASER_FALLBACK_PARAS = 3;
export const TEASER_PARAS = TEASER_FALLBACK_PARAS;

export function chunkArticles<T>(
  items: T[],
  size = TEASER_MAX_ARTICLES,
): T[][] {
  const n = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

/** FFS “Powered by” lockup on carousel pages (attribution only — not a Premium CTA). */
export const FFS_LOGO_FILENAME = "ffs-logo.png";

/**
 * Caption-only Scout URL (XHS post body for Ray to paste).
 * Never render this path, label, or origin on carousel PNGs.
 */
export const XHS_SCOUT_CTA_PATH = "/scout";
export const XHS_SCOUT_CTA_LABEL = "来 Faleague 读 Scout 中文 →";
export const DEFAULT_SITE_ORIGIN = "https://www.faleague-ai.com";

const VISIBLE_URL_RE =
  /https?:\/\/[^\s<]+|\bwww\.[^\s<]+|\b[a-z0-9][a-z0-9.-]*\.(?:co\.uk|com|net|org|io|ai)(?:\/[^\s<]*)?/gi;

/** Strip URL-like tokens from plain text (titles, captions on-image). */
export function stripVisibleUrlText(text: string): string {
  return text
    .replace(VISIBLE_URL_RE, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、])/g, "$1")
    .trim();
}

/**
 * Keep inner copy, drop hrefs and any visible http/www/domain text.
 * Image `src` attributes are left intact so figures still load.
 */
export function stripVisibleUrlsFromHtml(html: string): string {
  const unwrapped = html.replace(/<a\b[^>]*>/gi, "").replace(/<\/a>/gi, "");
  return unwrapped.replace(/>([^<]+)</g, (_m, text: string) => {
    return `>${stripVisibleUrlText(text)}<`;
  });
}

export function scoutPublicDir(cwd = process.cwd()): string {
  return join(cwd, "public", "scout");
}

export function ffsLogoPath(cwd = process.cwd()): string {
  return join(scoutPublicDir(cwd), FFS_LOGO_FILENAME);
}

export function resolveScoutCta(origin?: string | null): {
  href: string;
  display: string;
  label: string;
} {
  const base = (origin?.trim() || DEFAULT_SITE_ORIGIN).replace(/\/$/, "");
  const href = `${base}${XHS_SCOUT_CTA_PATH}`;
  const display = href.replace(/^https?:\/\/(www\.)?/i, "");
  return { href, display, label: XHS_SCOUT_CTA_LABEL };
}

const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g;

const PAYWALL_SLUG_RE =
  /hall-of-famer|hall-of-famers|team-reveal|goals-assists-bonus-defcon/i;

const PAYWALL_BODY_RE =
  /此内容仅限|requires a Fantasy Football Scout user account|register\?via=Editorial/i;

const PROMO_SRC_RE =
  /image-2026-07-24T120104|Dont-Chase-Last-Weeks|FFScoutEditorial|伴侣应用/i;

export type LocalScoutZh = {
  slug: string;
  dir: string;
  title_zh: string;
  excerpt_zh: string;
  /** ~200 words / 30s–1min ZH summary for XHS teaser pages. Not the site excerpt. */
  summary_zh: string;
  title_en: string;
  excerpt_en: string | null;
  author: string | null;
  series: string;
  source_url: string;
  source_published_at: string | null;
  translate_requested_at: string | null;
  status: string;
  body_html_zh: string;
  zh_mtime_ms: number;
};

export type ScoutXhsBlock = {
  html: string;
  kind: "heading" | "p" | "list" | "quote" | "figure" | "table" | "other";
};

export type PresserSlot = {
  time: string;
  name: string;
  mark: string;
};

export type ScoutTeaserCard = {
  slug: string;
  title_zh: string;
  seriesLabel: string;
  gwTag: string | null;
  parasHtml: string;
  heroSrc: string | null;
  /** Cover-grid image from the article, never the match-result lockup. */
  coverSrc: string | null;
  coverFit: "cover" | "contain";
  heroFit: "cover" | "contain";
  schedule: PresserSlot[];
  scheduleTitle: string;
};

export type SkipReason =
  | "missing_zh"
  | "not_chinese"
  | "paywall"
  | "too_short"
  | "not_in_window";

export function scoutTranslateRoot(cwd = process.cwd()): string {
  return join(cwd, "output", "scout-translate");
}

export function scoutXhsOutRoot(cwd = process.cwd()): string {
  return join(cwd, "output", "scout-xhs");
}

export function countCjk(text: string): number {
  return (text.match(CJK_RE) ?? []).length;
}

export function isPromoImageSrc(src: string): boolean {
  return PROMO_SRC_RE.test(src);
}

/** Ticker / price / stats screenshots — cover-crop hides them or cuts the graphic. */
export function isChartLikeSrc(src: string): boolean {
  if (!src) return false;
  return (
    /image-\d{3,}/i.test(src) ||
    /Projected-Goal|clean-sheet|price.change/i.test(src) ||
    /1024x(77|81|174|20\d)/i.test(src) ||
    /gw\d+-clean-sheet/i.test(src) ||
    /pbs\.twimg\.com|_tweet-media/i.test(src)
  );
}

/** Ultra-wide data strips that look empty when cropped into a cover tile. */
export function isThinStripSrc(src: string): boolean {
  const m = src.match(/(\d{3,4})x(\d{2,3})(?=\D|$)/i);
  if (!m) return false;
  return Number(m[2]) > 0 && Number(m[2]) < 220;
}

/**
 * Scout notes put the green FT scoreboard first (`image-519.png`, `image-518-1024x283.png`).
 * `figureIndex` is 0-based among `<figure>` tags.
 */
export function isMatchResultSrc(src: string, figureIndex: number): boolean {
  if (!src || figureIndex !== 0) return false;
  return /\/image-\d{3,}/i.test(src);
}

export function isPhotoLikeSrc(src: string): boolean {
  if (!src || isPromoImageSrc(src) || isThinStripSrc(src)) return false;
  if (/1024x/i.test(src)) return false;
  if (/image-20\d{2}-\d{2}-\d{2}T/i.test(src)) return false;
  return true;
}

/** Tweet ids from FFS embeds (`x.com/.../status/ID`) so we can pull the attached photo. */
export function extractTweetIds(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(?:twitter|x)\.com\/[^/\s"'<>]+\/status(?:es)?\/(\d{10,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function isTeamNewsArticle(article: Pick<LocalScoutZh, "series" | "title_zh" | "slug">): boolean {
  return (
    article.series === "team_news" ||
    /球队新闻|伤情/.test(article.title_zh) ||
    /team-news/.test(article.slug)
  );
}

/** Times + managers from the FFS press-conference tweet embed. */
export function extractPresserSchedule(html: string): PresserSlot[] {
  const text = stripTags(html.replace(/<br\s*\/?>/gi, "\n"))
    .replace(/pic\.(?:twitter|x)\.com\/\S+/gi, "")
    .replace(/\u00a0/g, " ");
  const slots: PresserSlot[] = [];
  const seen = new Set<string>();
  const re =
    /([^\s\dA-Za-z]{1,4})?\s*(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\s*[—–\-－—]{1,4}\s*([A-Za-z][A-Za-z .'-]{0,40})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const mark = (m[1] ?? "").trim();
    const time = m[2]!.replace(/\s+/g, "").toLowerCase();
    const name = m[3]!.replace(/\s+pic\..*$/i, "").trim().split(/\s+/).slice(0, 2).join(" ");
    if (!name || name.length < 3) continue;
    const key = `${time}|${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    slots.push({ time, name, mark });
  }
  return slots.length >= 3 ? slots : [];
}

export function presserScheduleTitle(html: string): string {
  const m = html.match(
    /<(h[2-4])[^>]*>\s*([^<]*(?:发布会|Press Conference)[^<]*)/i,
  );
  const title = m?.[2] ? stripTags(m[2]).trim() : "";
  return title.slice(0, 24) || "发布会时间";
}

export function isPaywallSlug(slug: string): boolean {
  return PAYWALL_SLUG_RE.test(slug);
}

export function looksLikePaywallLeftover(slug: string, html: string): boolean {
  if (isPaywallSlug(slug)) return true;
  if (!PAYWALL_BODY_RE.test(html)) return false;
  const cleaned = stripTags(stripScoutAds(html));
  return cleaned.length < 1400;
}

export function skipReasonFor(article: LocalScoutZh): SkipReason | null {
  if (!article.body_html_zh.trim()) return "missing_zh";
  if (looksLikePaywallLeftover(article.slug, article.body_html_zh)) {
    return "paywall";
  }
  if (countCjk(article.body_html_zh) < 80) return "not_chinese";
  const blocks = articleBlocks(article.body_html_zh);
  if (blocks.length === 0) return "too_short";
  return null;
}

export function stripScoutAds(html: string): string {
  let out = html;
  out = out.replace(/<figure>[\s\S]*?<\/figure>/gi, (fig) =>
    /FFScoutEditorial|Dont-Chase-Last-Weeks|image-2026-07-24T120104|伴侣应用/.test(fig)
      ? ""
      : fig,
  );
  out = out.replace(
    /<p>\s*<strong>\s*<a[^>]*(?:FFScoutEditorial|bit\.ly\/(?:FFScoutEditorial|joinffscout))[\s\S]*?<\/p>/gi,
    "",
  );
  out = out.replace(/<div>\s*<a[^>]*register\?via=Editorial[\s\S]*?<\/div>/gi, "");
  out = out.replace(/<a[^>]*register\?via=Editorial[^>]*>[\s\S]*?<\/a>/gi, "");
  out = out.replace(
    /此内容仅限[\s\S]{0,900}?用 Fantasy Football Scout[\s\S]{0,80}?<\/a>/gi,
    "",
  );
  out = out.replace(
    /<img[^>]*(?:image-2026-07-24T120104|Dont-Chase-Last-Weeks|伴侣应用)[^>]*>/gi,
    "",
  );
  out = out.replace(/<div>\s*<span>\s*<\/span>\s*/gi, "<div>");
  out = out.replace(/<div>\s*<\/div>/gi, "");
  out = out.replace(/<hr\s*\/?>/gi, "");
  out = out.replace(/<p>\s*<\/p>/gi, "");
  return out.trim();
}

function unwrapUselessDivs(html: string): string {
  return html
    .replace(/<span>\s*<\/span>/gi, "")
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/<\/?div>/gi, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function articleBlocks(rawHtml: string): ScoutXhsBlock[] {
  const stripped = stripScoutAds(rawHtml);
  const { html } = sanitizeScoutHtml(stripped);
  const unwrapped = unwrapUselessDivs(html);
  const re =
    /<(h[1-6]|p|ul|ol|blockquote|figure|table)(\s[^>]*)?>[\s\S]*?<\/\1>|<img\b[^>]*>/gi;
  const blocks: ScoutXhsBlock[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(unwrapped))) {
    const raw = m[0].trim();
    if (!raw) continue;
    if (/^<img\b/i.test(raw)) {
      const src = raw.match(/src=["']([^"']+)/i)?.[1] ?? "";
      if (isPromoImageSrc(src)) continue;
      blocks.push({
        html: `<figure>${raw}</figure>`,
        kind: "figure",
      });
      continue;
    }
    const kind = blockKind(raw);
    if (kind === "figure") {
      const src = raw.match(/src=["']([^"']+)/i)?.[1] ?? "";
      if (isPromoImageSrc(src)) continue;
    }
    const cleanHtml = stripVisibleUrlsFromHtml(raw);
    const text = stripTags(cleanHtml);
    if (!text && kind !== "figure") continue;
    if (kind === "p" && !text.trim()) continue;
    if (kind === "p") {
      blocks.push(...splitLongParagraph(cleanHtml));
      continue;
    }
    if (kind === "quote") {
      blocks.push(...splitTallQuote(cleanHtml));
      continue;
    }
    blocks.push({ html: cleanHtml, kind });
  }
  return mergeRelatedReading(blocks);
}

function blockKind(html: string): ScoutXhsBlock["kind"] {
  if (/^<h[1-6]\b/i.test(html)) return "heading";
  if (/^<p\b/i.test(html)) return "p";
  if (/^<(ul|ol)\b/i.test(html)) return "list";
  if (/^<blockquote\b/i.test(html)) return "quote";
  if (/^<figure\b/i.test(html) || /<img\b/i.test(html)) return "figure";
  if (/^<table\b/i.test(html)) return "table";
  return "other";
}

function splitLongParagraph(html: string): ScoutXhsBlock[] {
  const inner = html.replace(/^<p[^>]*>/i, "").replace(/<\/p>$/i, "");
  const text = stripTags(inner);
  if (text.length <= 240) return [{ html, kind: "p" }];
  const parts: string[] = [];
  let buf = "";
  for (const ch of inner) {
    buf += ch;
    if ("。！？".includes(ch) && stripTags(buf).length >= 90) {
      parts.push(buf);
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf);
  if (parts.length <= 1) return [{ html, kind: "p" }];
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({ html: `<p>${p}</p>`, kind: "p" as const }));
}

function splitTallQuote(html: string): ScoutXhsBlock[] {
  const inner = html
    .replace(/^<blockquote[^>]*>/i, "")
    .replace(/<\/blockquote>$/i, "")
    .trim();
  const paras = inner.match(/<p\b[\s\S]*?<\/p>/gi);
  if (!paras || paras.length <= 1) return [{ html, kind: "quote" }];
  const text = stripTags(inner);
  if (text.length <= 280) return [{ html, kind: "quote" }];
  return paras.map((p) => ({
    html: `<blockquote>${p}</blockquote>`,
    kind: "quote" as const,
  }));
}

function mergeRelatedReading(blocks: ScoutXhsBlock[]): ScoutXhsBlock[] {
  return blocks.map((b) => {
    if (b.kind !== "list") return b;
    if (!/延伸阅读/.test(b.html)) return b;
    const compact = b.html
      .replace(/<li>/gi, "<li>")
      .replace(/target="_blank"[^>]*/gi, "");
    return { ...b, html: compact };
  });
}

export function pickHeroSrc(
  blocks: ScoutXhsBlock[],
  skipSrc?: string | null,
): string | null {
  const skip = skipSrc ?? "";
  for (const b of blocks) {
    if (b.kind !== "figure") continue;
    const src = b.html.match(/src=["']([^"']+)/i)?.[1] ?? "";
    if (!src || src === skip || isPromoImageSrc(src)) continue;
    if (/Screen-Shot/i.test(src)) continue;
    return src;
  }
  for (const b of blocks) {
    if (b.kind !== "figure") continue;
    const src = b.html.match(/src=["']([^"']+)/i)?.[1] ?? "";
    if (src && src !== skip && !isPromoImageSrc(src)) return src;
  }
  return null;
}

/** First in-article figure that is not the FT scoreboard or a thin data strip. */
export function pickCoverFigureSrc(blocks: ScoutXhsBlock[]): string | null {
  let figureIndex = 0;
  for (const b of blocks) {
    if (b.kind !== "figure") continue;
    const src = b.html.match(/src=["']([^"']+)/i)?.[1] ?? "";
    const idx = figureIndex++;
    if (!src || isPromoImageSrc(src) || /Screen-Shot/i.test(src)) continue;
    if (isMatchResultSrc(src, idx)) continue;
    if (isThinStripSrc(src)) continue;
    return src;
  }
  return null;
}

export function dropHeroFromBlocks(
  blocks: ScoutXhsBlock[],
  heroSrc: string | null,
): ScoutXhsBlock[] {
  if (!heroSrc) return blocks;
  let dropped = false;
  return blocks.filter((b) => {
    if (dropped || b.kind !== "figure") return true;
    if (b.html.includes(heroSrc)) {
      dropped = true;
      return false;
    }
    return true;
  });
}

export function seriesLabel(series: string, titleZh: string): string {
  if (series === "scout_notes" || /笔记/.test(titleZh)) return "FPL 笔记";
  if (series === "team_news" || /球队新闻|伤情/.test(titleZh)) return "球队新闻";
  if (series === "preview") return "赛前瞻";
  if (series === "review") return "赛后复盘";
  return "Scout 中文";
}

export function gwTag(slug: string, titleZh: string, titleEn: string): string | null {
  const blob = `${slug} ${titleZh} ${titleEn}`;
  const m =
    blob.match(/gameweek[- ]?(\d+)/i) ||
    titleZh.match(/第\s*(\d+)\s*轮/) ||
    blob.match(/\bgw\s*(\d+)/i);
  if (m) return `GW${m[1]}`;
  if (/2026-27|2026\/27/.test(blob)) return "2026/27";
  return null;
}

export function publishedAtMs(article: LocalScoutZh): number {
  if (article.source_published_at) {
    const t = Date.parse(article.source_published_at);
    if (!Number.isNaN(t)) return t;
  }
  const fromUrl = article.source_url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (fromUrl) {
    return Date.parse(`${fromUrl[1]}-${fromUrl[2]}-${fromUrl[3]}T12:00:00Z`);
  }
  return article.zh_mtime_ms;
}

function parseMetaJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function loadLocalScoutZh(cwd = process.cwd()): LocalScoutZh[] {
  const root = scoutTranslateRoot(cwd);
  if (!existsSync(root)) return [];
  const out: LocalScoutZh[] = [];
  for (const dirent of readdirSync(root, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const dir = join(root, dirent.name);
    const zhPath = join(dir, "body_html_zh.html");
    const metaZhPath = join(dir, "meta.zh.json");
    if (!existsSync(zhPath) || !existsSync(metaZhPath)) continue;
    const meta = parseMetaJson(join(dir, "meta.json"));
    const metaZh = parseMetaJson(metaZhPath);
    let zh_mtime_ms = 0;
    try {
      zh_mtime_ms = statSync(zhPath).mtimeMs;
    } catch {
      zh_mtime_ms = 0;
    }
    const title_zh = String(metaZh.title_zh ?? "").trim();
    const excerpt_zh = String(metaZh.excerpt_zh ?? "").trim();
    const summary_zh = String(metaZh.summary_zh ?? "").trim();
    const body = readFileSync(zhPath, "utf8");
    out.push({
      slug: String(meta.slug ?? dirent.name),
      dir,
      title_zh,
      excerpt_zh,
      summary_zh,
      title_en: String(meta.title_en ?? ""),
      excerpt_en: meta.excerpt_en ? String(meta.excerpt_en) : null,
      author: meta.author ? String(meta.author) : null,
      series: String(meta.series ?? "other"),
      source_url: String(meta.source_url ?? ""),
      source_published_at: meta.source_published_at
        ? String(meta.source_published_at)
        : null,
      translate_requested_at: meta.translate_requested_at
        ? String(meta.translate_requested_at)
        : null,
      status: String(meta.status ?? "pending"),
      body_html_zh: body,
      zh_mtime_ms,
    });
  }
  return out;
}

export function isNotesArticle(article: LocalScoutZh): boolean {
  return article.series === "scout_notes" || article.slug.startsWith("fpl-notes-");
}

export function priorityScore(article: LocalScoutZh): number {
  // Recency first; Notes jump ahead of other series inside the same window.
  let n = publishedAtMs(article);
  if (isNotesArticle(article)) n += 10 * 24 * 60 * 60 * 1000;
  if (article.series === "team_news") n += 12 * 60 * 60 * 1000;
  if (/this-evening|this-morning/.test(article.slug)) n -= 3 * 24 * 60 * 60 * 1000;
  if (/iraola-on-szoboszlai/.test(article.slug)) n += 1e7;
  return n;
}

export type SelectOpts = {
  slugs?: string[];
  latest?: number;
  days?: number;
  force?: boolean;
  now?: Date;
};

export function selectScoutXhsArticles(
  articles: LocalScoutZh[],
  opts: SelectOpts,
): {
  selected: LocalScoutZh[];
  skipped: { slug: string; reason: SkipReason | "not_found" }[];
} {
  const skipped: { slug: string; reason: SkipReason | "not_found" }[] = [];
  const bySlug = new Map(articles.map((a) => [a.slug, a]));

  if (opts.slugs?.length) {
    const selected: LocalScoutZh[] = [];
    for (const slug of opts.slugs) {
      const a = bySlug.get(slug);
      if (!a) {
        skipped.push({ slug, reason: "not_found" });
        continue;
      }
      const reason = skipReasonFor(a);
      if (reason && !opts.force) {
        skipped.push({ slug, reason });
        continue;
      }
      selected.push(a);
    }
    return { selected, skipped };
  }

  const now = opts.now ?? new Date();
  const days = opts.days ?? DEFAULT_DAYS;
  const cap = opts.latest ?? DEFAULT_LATEST;
  const windowMs = days * 24 * 60 * 60 * 1000;
  const eligible: LocalScoutZh[] = [];

  for (const a of articles) {
    const reason = skipReasonFor(a);
    if (reason) {
      skipped.push({ slug: a.slug, reason });
      continue;
    }
    if (days > 0 && now.getTime() - publishedAtMs(a) > windowMs) {
      skipped.push({ slug: a.slug, reason: "not_in_window" });
      continue;
    }
    eligible.push(a);
  }

  eligible.sort((a, b) => priorityScore(b) - priorityScore(a));
  const selected = eligible.slice(0, Math.max(1, cap));
  for (const a of eligible.slice(selected.length)) {
    skipped.push({ slug: a.slug, reason: "not_in_window" });
  }
  return { selected, skipped };
}

/** Other eligible ZH articles, for the last carousel page. */
export function leftoverTeaserArticles(
  pool: LocalScoutZh[],
  usedSlugs: string[],
  opts: { max?: number; days?: number; now?: Date } = {},
): LocalScoutZh[] {
  const used = new Set(usedSlugs);
  const now = opts.now ?? new Date();
  const days = opts.days ?? 21;
  const max = opts.max ?? CLOSE_MORE_MAX;
  const windowMs = days > 0 ? days * 24 * 60 * 60 * 1000 : 0;
  const out: LocalScoutZh[] = [];
  for (const a of pool) {
    if (used.has(a.slug)) continue;
    if (skipReasonFor(a)) continue;
    if (windowMs && now.getTime() - publishedAtMs(a) > windowMs) continue;
    const title = stripVisibleUrlText(a.title_zh).trim();
    if (!title || countCjk(title) < 4) continue;
    out.push(a);
  }
  out.sort((a, b) => priorityScore(b) - priorityScore(a));
  return out.slice(0, Math.max(0, max));
}

export function packBlocksByHeight(
  blocks: ScoutXhsBlock[],
  heights: number[],
  maxHeight: number,
): ScoutXhsBlock[][] {
  const pages: ScoutXhsBlock[][] = [];
  let current: ScoutXhsBlock[] = [];
  let used = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const h = Math.max(1, heights[i] ?? 80);
    const next = used + h;
    const headingNeedsRoom =
      block.kind === "heading" && current.length > 0 && next > maxHeight * 0.68;
    if (current.length > 0 && (next > maxHeight || headingNeedsRoom)) {
      pages.push(current);
      current = [block];
      used = h;
    } else {
      current.push(block);
      used = next;
    }
  }
  if (current.length) pages.push(current);
  // Don't leave a heading as the last item on a page.
  for (let i = 0; i < pages.length - 1; i++) {
    const page = pages[i]!;
    const last = page[page.length - 1];
    if (last?.kind === "heading") {
      page.pop();
      pages[i + 1]!.unshift(last);
      if (page.length === 0) {
        pages.splice(i, 1);
        i -= 1;
      }
    }
  }
  return pages.length ? pages : [[]];
}

function looksLikeBoilerplatePara(text: string): boolean {
  return (
    text.length < 12 ||
    /出现在 Best FPL Tips|appeared first on/i.test(text) ||
    /加入 FFScout|Join FFScout/i.test(text)
  );
}

function escapeHtmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Blank-line paragraphs → `<p>` for the carousel. No URLs. */
export function summaryZhToHtml(summary: string): string {
  const parts = summary
    .trim()
    .split(/\n\s*\n/)
    .map((p) => stripVisibleUrlText(p.replace(/\s*\n+\s*/g, " ").trim()))
    .filter(Boolean);
  if (!parts.length) return "";
  return parts.map((p) => `<p>${escapeHtmlText(p)}</p>`).join("\n");
}

export function teaserCopyHtml(
  article: Pick<LocalScoutZh, "summary_zh" | "body_html_zh" | "excerpt_zh">,
): string {
  const summary = (article.summary_zh ?? "").trim();
  if (summary) return summaryZhToHtml(summary);
  return extractTeaserParagraphs(
    article.body_html_zh,
    article.excerpt_zh,
    TEASER_FALLBACK_PARAS,
  ).join("\n");
}

/** First real body blocks. Excerpt is fallback only if the body has no usable `<p>`. */
export function extractTeaserParagraphs(
  html: string,
  excerptZh = "",
  max = TEASER_FALLBACK_PARAS,
): string[] {
  const excerpt = stripVisibleUrlText(excerptZh.trim());
  const stripped = stripVisibleUrlsFromHtml(stripScoutAds(html));
  const matches = stripped.match(/<(p|ul|ol|blockquote)\b[^>]*>[\s\S]*?<\/\1>/gi) ?? [];
  const paras: string[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    if (paras.length >= max) break;
    const text = stripVisibleUrlText(stripTags(raw)).trim();
    if (text.length < 12 || looksLikeBoilerplatePara(text)) continue;
    const key = text.slice(0, 18);
    if (seen.has(key)) continue;
    seen.add(key);
    paras.push(raw);
  }

  if (paras.length === 0 && excerpt && countCjk(excerpt) >= 8) {
    paras.push(`<p>${excerpt}</p>`);
  }
  return paras.slice(0, max);
}

export function buildTeaserCards(
  articles: LocalScoutZh[],
  max = TEASER_MAX_ARTICLES,
): ScoutTeaserCard[] {
  return articles.slice(0, Math.max(1, max)).map((article) => {
    const blocks = articleBlocks(article.body_html_zh);
    const heroSrc = pickHeroSrc(blocks);
    const coverSrc = pickCoverFigureSrc(blocks);
    const schedule = extractPresserSchedule(article.body_html_zh);
    return {
      slug: article.slug,
      title_zh: stripVisibleUrlText(article.title_zh),
      seriesLabel: seriesLabel(article.series, article.title_zh),
      gwTag: gwTag(article.slug, article.title_zh, article.title_en),
      parasHtml: teaserCopyHtml(article),
      heroSrc,
      coverSrc,
      coverFit: coverSrc && isPhotoLikeSrc(coverSrc) ? "cover" : "contain",
      heroFit: heroSrc && isChartLikeSrc(heroSrc) ? "contain" : "cover",
      schedule,
      scheduleTitle: schedule.length ? presserScheduleTitle(article.body_html_zh) : "",
    };
  });
}

/** XHS post body only — links stay here, never on the PNGs. */
export function buildTeaserCaption(
  articles: LocalScoutZh[],
  ctaDisplay = resolveScoutCta().display,
): string {
  const titles = articles.map((a) => `· ${a.title_zh}`).join("\n");
  const lines = [
    "Scout 中文精选",
    "",
    titles,
    "",
    "图里是精选摘要，大约半分钟到一分钟读完。完整中文请到 Faleague Scout 专栏阅读，注册后可持续跟笔记和伤情。",
    `阅读入口：${ctaDisplay}`,
    "",
    "#FPL #英超 #FantasyFootballScout #Faleague #Scout中文",
  ];
  return lines.join("\n");
}

/** XHS post body only — links stay here, never on the PNGs. */
export function buildCaption(
  article: LocalScoutZh,
  ctaDisplay = resolveScoutCta().display,
): string {
  const lines = [
    article.title_zh,
    "",
    article.excerpt_zh,
    "",
    "左滑看全文。原文 Fantasy Football Scout，中文整理 Faleague。",
    `完整中文请到 ${ctaDisplay} 阅读 Scout 专栏。`,
    "",
    "#FPL #英超 #FantasyFootballScout #Faleague #FPL笔记",
  ];
  if (article.source_url) {
    lines.push("", `原文：${article.source_url}`);
  }
  return lines.join("\n");
}

export function looksLikeChineseTitle(title: string): boolean {
  return looksLikeChinese(title);
}
