#!/usr/bin/env node
/**
 * Render Xiaohongshu 3:4 carousel PNGs from translated Scout articles.
 *
 * Default is a **teaser feed** (cover of titles + images, then one page per
 * article with a ~200-word `summary_zh` + bottom image). Full-article carousels are
 * opt-in via `--full`.
 *
 *   cd web
 *   npx tsx scripts/scout-xhs-pages.ts
 *   npx tsx scripts/scout-xhs-pages.ts --slugs=a,b,c,d
 *   npx tsx scripts/scout-xhs-pages.ts --all
 *   npx tsx scripts/scout-xhs-pages.ts --full --slug=one-article
 *   npx tsx scripts/scout-xhs-pages.ts --theme=xhs --slugs=a,b,c,d
 *   npx tsx scripts/scout-xhs-pages.ts --full-passage --theme=xhs --slugs=main,other1,other2
 *     → full body carousel for `main`, close page lists other1/other2 titles
 *
 * After Cursor translate `--apply`, the writer also runs this teaser step
 * for the slugs just written (unless `--no-xhs`).
 *
 * A second teaser run the same day writes `feed-YYYYMMDD-2` (then -3, …)
 * instead of replacing the earlier carousel folder.
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { loadScriptEnv } from "./load-env";
import {
  DEFAULT_DAYS,
  DEFAULT_LATEST,
  MAX_PAGES,
  XHS_HEIGHT,
  XHS_WIDTH,
  articleBlocks,
  buildCaption,
  buildTeaserCaption,
  buildTeaserCards,
  dropHeroFromBlocks,
  extractTweetIds,
  ffsLogoPath,
  gwTag,
  isChartLikeSrc,
  isMatchResultSrc,
  isTeamNewsArticle,
  loadLocalScoutZh,
  packBlocksByHeight,
  pickHeroSrc,
  resolveScoutCta,
  scoutXhsOutRoot,
  selectScoutXhsArticles,
  seriesLabel,
  stripVisibleUrlText,
  chunkArticles,
  publishedAtMs,
  skipReasonFor,
  closePageMoreTitles,
  CLOSE_MORE_MAX,
  TEASER_MAX_ARTICLES,
  type LocalScoutZh,
  type ScoutTeaserCard,
  type ScoutXhsBlock,
} from "../lib/scout/xhs-pages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, "wechat", "xhs-scout-article.html");

/** Leave room for the FFS lockup + plain-text attribution footer (no CTA / URL). */
const BODY_MAX_HEIGHT = 800;

let logoSrc = "";
let ctaLabel = "";
let ctaDisplay = "";
let renderTheme: string | undefined;

function withAssets(data: Record<string, unknown>): Record<string, unknown> {
  return renderTheme ? { ...data, logoSrc, theme: renderTheme } : { ...data, logoSrc };
}

function tweetMediaDir(outRoot: string): string {
  return join(outRoot, "_tweet-media");
}

async function fetchTweetPhotoUrl(tweetId: string): Promise<string | null> {
  const urls = [
    `https://api.fxtwitter.com/status/${tweetId}`,
    `https://api.fxtwitter.com/i/status/${tweetId}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "FaleagueScoutXhs/1.0",
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        tweet?: { media?: { photos?: Array<{ url?: string }> } };
      };
      const photo = data.tweet?.media?.photos?.[0]?.url?.trim();
      if (photo) return photo;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function cacheRemoteImage(url: string, dest: string): Promise<boolean> {
  if (existsSync(dest)) return true;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) return false;
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

function localImageSrc(path: string): string {
  const buf = readFileSync(path);
  const ext = path.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  return `data:image/${ext};base64,${buf.toString("base64")}`;
}

/** Local data URL for a tweet photo embedded in Scout HTML (presser schedules, etc.). */
async function cacheTweetHero(html: string, cacheDir: string): Promise<string | null> {
  for (const tweetId of extractTweetIds(html)) {
    const dest = join(cacheDir, `${tweetId}.jpg`);
    if (!(existsSync(dest) && statSync(dest).size > 800)) {
      const photoUrl = await fetchTweetPhotoUrl(tweetId);
      if (!photoUrl) continue;
      if (!(await cacheRemoteImage(photoUrl, dest))) continue;
    }
    return localImageSrc(dest);
  }
  return null;
}

async function resolveHeroSrc(
  article: LocalScoutZh,
  picked: string | null,
  cacheDir: string,
): Promise<string | null> {
  const tweetHero = await cacheTweetHero(article.body_html_zh, cacheDir);
  if (isTeamNewsArticle(article) && tweetHero) return tweetHero;
  return picked || tweetHero;
}

function flagStr(name: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return null;
  const v = raw.slice(name.length + 3).trim();
  return v || null;
}

function parseSlugs(): string[] {
  const raw = flagStr("slugs") || flagStr("slug");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntFlag(name: string, fallback: number | null): number | null {
  const raw = flagStr(name);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function waitTemplateReady(page: import("playwright").Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { renderPage?: unknown }).renderPage === "function",
    null,
    { timeout: 15000 },
  );
}

async function renderOnePage(
  page: import("playwright").Page,
  data: Record<string, unknown>,
  outPath: string,
): Promise<void> {
  await page.evaluate((payload) => {
    (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
  }, withAssets(data));
  try {
    await page.evaluate(() =>
      (window as unknown as { waitPageImages: () => Promise<void> }).waitPageImages(),
    );
  } catch {
    /* images optional */
  }
  await page.waitForTimeout(280);
  await page.screenshot({ path: outPath, type: "png" });
}

async function paginateBody(
  page: import("playwright").Page,
  blocks: ScoutXhsBlock[],
): Promise<ScoutXhsBlock[][]> {
  if (!blocks.length) return [[]];
  const heights = (await page.evaluate(async (htmls: string[]) => {
    return (window as unknown as { measureBlocks: (b: string[]) => Promise<number[]> }).measureBlocks(
      htmls,
    );
  }, blocks.map((b) => b.html))) as number[];
  return packBlocksByHeight(blocks, heights, BODY_MAX_HEIGHT);
}

function bodyPagePayload(
  article: LocalScoutZh,
  blocks: ScoutXhsBlock[],
  pageNo: number,
  total: number,
  series: string,
  gw: string | null,
): Record<string, unknown> {
  return {
    kind: "body",
    page: pageNo,
    total,
    title: stripVisibleUrlText(article.title_zh),
    seriesLabel: series,
    gwTag: gw,
    html: blocks.map((b) => b.html).join("\n"),
  };
}

async function pageOverflow(page: import("playwright").Page): Promise<number> {
  return page.evaluate(() =>
    (window as unknown as { bodyOverflow: () => number }).bodyOverflow(),
  );
}

async function reflowPackedPages(
  page: import("playwright").Page,
  article: LocalScoutZh,
  packed: ScoutXhsBlock[][],
  series: string,
  gw: string | null,
): Promise<ScoutXhsBlock[][]> {
  const out: ScoutXhsBlock[][] = [];
  const queue = packed.map((g) => [...g]);
  let carry: ScoutXhsBlock[] = [];

  while (queue.length || carry.length) {
    let blocks = carry.length ? carry : queue.shift()!;
    carry = [];
    const guess = Math.min(MAX_PAGES, out.length + queue.length + 2);
    await page.evaluate((payload) => {
      (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
    }, withAssets(bodyPagePayload(article, blocks, out.length + 2, guess, series, gw)));
    try {
      await page.evaluate(() =>
        (window as unknown as { waitPageImages: () => Promise<void> }).waitPageImages(),
      );
    } catch {
      /* optional */
    }
    let overflow = await pageOverflow(page);
    while (overflow > 16 && blocks.length > 1) {
      carry.unshift(blocks.pop()!);
      await page.evaluate((payload) => {
        (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
      }, withAssets(bodyPagePayload(article, blocks, out.length + 2, guess, series, gw)));
      overflow = await pageOverflow(page);
    }
    out.push(blocks);
    if (carry.length) {
      if (queue[0]) queue[0] = [...carry, ...queue[0]];
      else queue.push(carry);
      carry = [];
    }
    if (out.length >= MAX_PAGES - 1 && (queue.length || carry.length)) {
      out[out.length - 1] = [
        ...out[out.length - 1]!,
        ...carry,
        ...queue.flat(),
      ];
      break;
    }
  }
  return out.length ? out : [[]];
}

async function generateArticle(
  page: import("playwright").Page,
  article: LocalScoutZh,
  outRoot: string,
): Promise<{ slug: string; pages: number; dir: string }> {
  const dir = join(outRoot, article.slug);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    if (/\.(png|jpg)$/i.test(name)) unlinkSync(join(dir, name));
  }

  const allBlocks = articleBlocks(article.body_html_zh);
  const heroSrc = await resolveHeroSrc(
    article,
    pickHeroSrc(allBlocks),
    tweetMediaDir(outRoot),
  );
  const bodyBlocks = dropHeroFromBlocks(allBlocks, heroSrc);
  let packed = await paginateBody(page, bodyBlocks);
  const series = seriesLabel(article.series, article.title_zh);
  const gw = gwTag(article.slug, article.title_zh, article.title_en);

  packed = await reflowPackedPages(page, article, packed, series, gw);

  if (packed.length + 1 > MAX_PAGES) {
    const head = packed.slice(0, MAX_PAGES - 1);
    const tail = packed.slice(MAX_PAGES - 1).flat();
    packed = tail.length ? [...head, tail] : head;
    console.warn(JSON.stringify({ warn: "truncated_to_max_pages", slug: article.slug }));
  }

  const actualTotal = packed.length + 1;
  await renderOnePage(
    page,
    {
      kind: "cover",
      page: 1,
      total: actualTotal,
      title: stripVisibleUrlText(article.title_zh),
      subtitle: stripVisibleUrlText(article.excerpt_zh),
      seriesLabel: series,
      gwTag: gw,
      heroSrc,
    },
    join(dir, "01.png"),
  );

  for (let i = 0; i < packed.length; i++) {
    const name = String(i + 2).padStart(2, "0") + ".png";
    await renderOnePage(
      page,
      bodyPagePayload(article, packed[i]!, i + 2, actualTotal, series, gw),
      join(dir, name),
    );
  }

  const caption = buildCaption(article, ctaDisplay);
  writeFileSync(join(dir, "caption.txt"), caption, "utf8");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        slug: article.slug,
        title_zh: article.title_zh,
        excerpt_zh: article.excerpt_zh,
        source_url: article.source_url,
        series: article.series,
        pages: actualTotal,
        hero: Boolean(heroSrc),
        cta_url: ctaDisplay,
        output: dir,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(
    JSON.stringify({
      ok: true,
      slug: article.slug,
      pages: actualTotal,
      dir,
    }),
  );
  return { slug: article.slug, pages: actualTotal, dir };
}

function ymdStamp(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function carouselExists(dir: string): boolean {
  if (!existsSync(dir)) return false;
  try {
    return readdirSync(dir).some(
      (name) => /\.(png|jpg)$/i.test(name) || name === "manifest.json",
    );
  } catch {
    return false;
  }
}

/** First unused `feed-YYYYMMDD`, then `feed-YYYYMMDD-2`, `-3`, … */
function nextDailyFeedStamp(outRoot: string, now = new Date()): string {
  const ymd = ymdStamp(now);
  const first = `feed-${ymd}`;
  if (!carouselExists(join(outRoot, first))) return first;
  for (let i = 2; i <= 99; i++) {
    const stamp = `feed-${ymd}-${i}`;
    if (!carouselExists(join(outRoot, stamp))) return stamp;
  }
  return `feed-${ymd}-${Date.now()}`;
}

function feedStamp(
  index = 1,
  { all = false, outRoot, theme }: { all?: boolean; outRoot?: string; theme?: string } = {},
): string {
  const root = outRoot ?? scoutXhsOutRoot();
  // Theme wins: same-day xhs packs use -xhs, -xhs-2, … even under `--all`.
  if (theme === "xhs") {
    const ymd = ymdStamp();
    const first = `feed-${ymd}-xhs`;
    if (!carouselExists(join(root, first))) return first;
    for (let i = 2; i <= 99; i++) {
      const stamp = `feed-${ymd}-xhs-${i}`;
      if (!carouselExists(join(root, stamp))) return stamp;
    }
    return `feed-${ymd}-xhs-${Date.now()}`;
  }
  if (all) return `feed-all-${String(index).padStart(2, "0")}`;
  return nextDailyFeedStamp(root);
}

async function generateTeaserFeed(
  page: import("playwright").Page,
  articles: LocalScoutZh[],
  outRoot: string,
  stamp: string,
  moreTitles: string[] = [],
): Promise<{ slug: string; pages: number; dir: string; titles: string[] }> {
  const cacheDir = tweetMediaDir(outRoot);
  const cards: ScoutTeaserCard[] = [];
  for (const card of buildTeaserCards(articles, TEASER_MAX_ARTICLES)) {
    const article = articles.find((a) => a.slug === card.slug);
    if (!article) {
      cards.push(card);
      continue;
    }
    if (card.schedule.length) {
      console.log(JSON.stringify({ presser_schedule: true, slug: article.slug, slots: card.schedule.length }));
      cards.push({ ...card, heroSrc: null });
      continue;
    }
    const heroSrc = await resolveHeroSrc(article, card.heroSrc, cacheDir);
    const fromTweet = Boolean(heroSrc?.startsWith("data:image/"));
    if (fromTweet) {
      console.log(JSON.stringify({ tweet_hero: true, slug: article.slug }));
    }
    if (card.coverSrc) {
      console.log(JSON.stringify({ cover_figure: card.coverSrc, slug: article.slug }));
    }
    cards.push({
      ...card,
      heroSrc,
      heroFit:
        heroSrc && (fromTweet || isChartLikeSrc(heroSrc))
          ? "contain"
          : heroSrc
            ? "cover"
            : card.heroFit,
    });
  }
  const dir = join(outRoot, stamp);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    if (/\.(png|jpg)$/i.test(name)) unlinkSync(join(dir, name));
  }

  const titles = cards.map((c) => c.title_zh);
  const gw =
    cards.map((c) => c.gwTag).find((g) => g) ??
    gwTag(articles[0]?.slug ?? "", articles[0]?.title_zh ?? "", articles[0]?.title_en ?? "");
  const total = cards.length + 2;

  await renderOnePage(
    page,
    {
      kind: "feed-cover",
      page: 1,
      total,
      title: "Scout 中文精选",
      seriesLabel: "精选",
      gwTag: gw,
      items: cards.map((c) => {
        const coverSrc =
          c.coverSrc ||
          (c.heroSrc && !isMatchResultSrc(c.heroSrc, 0) ? c.heroSrc : "") ||
          logoSrc ||
          "";
        return {
          title: c.title_zh,
          heroSrc: c.schedule.length ? "" : coverSrc,
          heroFit: c.coverSrc ? c.coverFit : c.heroSrc ? c.heroFit : "contain",
          face: Boolean(c.coverSrc && c.coverFit === "cover"),
          schedule: c.schedule,
          scheduleTitle: c.scheduleTitle,
        };
      }),
    },
    join(dir, "01.png"),
  );

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]!;
    const name = String(i + 2).padStart(2, "0") + ".png";
    const chunks = card.parasHtml
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const base = {
      kind: "teaser",
      page: i + 2,
      total,
      title: card.title_zh,
      seriesLabel: card.seriesLabel,
      gwTag: card.gwTag,
      heroSrc: card.schedule.length ? "" : card.heroSrc,
      heroFit: card.heroFit,
      schedule: card.schedule,
      scheduleTitle: card.scheduleTitle,
    };
    let html = chunks.join("\n");
    while (chunks.length > 1) {
      await page.evaluate((payload) => {
        (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
      }, withAssets({ ...base, html: chunks.join("\n") }));
      try {
        await page.evaluate(() =>
          (window as unknown as { waitPageImages: () => Promise<void> }).waitPageImages(),
        );
      } catch {
        /* optional */
      }
      const overflow = await pageOverflow(page);
      if (overflow <= 20) {
        html = chunks.join("\n");
        break;
      }
      chunks.pop();
      html = chunks.join("\n");
    }
    await renderOnePage(page, { ...base, html }, join(dir, name));
  }

  const more = moreTitles
    .map((t) => stripVisibleUrlText(t).trim())
    .filter(Boolean)
    .slice(0, CLOSE_MORE_MAX);

  const closeBase = {
    kind: "feed-close",
    page: total,
    total,
    title: "完整文章在 Faleague",
    subtitle: more.length
      ? "去 Scout 中文专栏看全文。下面这些未出现在封面。"
      : "去 Scout 中文专栏看全文、笔记和伤情。",
    seriesLabel: "Scout 中文",
    gwTag: gw,
  };
  let listed = [...more];
  while (listed.length > 0) {
    await page.evaluate((payload) => {
      (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
    }, withAssets({ ...closeBase, moreTitles: listed }));
    const overflow = await pageOverflow(page);
    if (overflow <= 16) break;
    listed.pop();
  }
  await renderOnePage(
    page,
    { ...closeBase, moreTitles: listed },
    join(dir, String(total).padStart(2, "0") + ".png"),
  );

  const caption = buildTeaserCaption(articles.slice(0, cards.length), ctaDisplay);
  writeFileSync(join(dir, "caption.txt"), caption, "utf8");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        mode: "teaser",
        theme: renderTheme ?? "faleague",
        slugs: cards.map((c) => c.slug),
        titles,
        more_titles: listed,
        pages: total,
        cta_url: ctaDisplay,
        output: dir,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(JSON.stringify({ ok: true, mode: "teaser", pages: total, dir, slugs: cards.map((c) => c.slug) }));
  return { slug: stamp, pages: total, dir, titles };
}

/**
 * Single-article feed: cover + full body pages + same feed-close as teasers.
 * `moreTitles` are listed on the last page (batch titles not in this article).
 */
async function generateFullPassageFeed(
  page: import("playwright").Page,
  article: LocalScoutZh,
  outRoot: string,
  stamp: string,
  moreTitles: string[] = [],
): Promise<{ slug: string; pages: number; dir: string; titles: string[] }> {
  const dir = join(outRoot, stamp);
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) {
    if (/\.(png|jpg)$/i.test(name)) unlinkSync(join(dir, name));
  }

  const allBlocks = articleBlocks(article.body_html_zh);
  const heroSrc = await resolveHeroSrc(
    article,
    pickHeroSrc(allBlocks),
    tweetMediaDir(outRoot),
  );
  if (heroSrc) {
    console.log(
      JSON.stringify({
        cover_figure: heroSrc.startsWith("data:") ? "(cached)" : heroSrc,
        slug: article.slug,
      }),
    );
  }
  const bodyBlocks = dropHeroFromBlocks(allBlocks, heroSrc);
  let packed = await paginateBody(page, bodyBlocks);
  const series = seriesLabel(article.series, article.title_zh);
  const gw = gwTag(article.slug, article.title_zh, article.title_en);
  packed = await reflowPackedPages(page, article, packed, series, gw);

  // cover + body pages + close
  const maxBody = Math.max(1, MAX_PAGES - 2);
  if (packed.length > maxBody) {
    const head = packed.slice(0, maxBody - 1);
    const tail = packed.slice(maxBody - 1).flat();
    packed = tail.length ? [...head, tail] : head;
    console.warn(JSON.stringify({ warn: "truncated_full_passage", slug: article.slug }));
  }

  const more = moreTitles
    .map((t) => stripVisibleUrlText(t).trim())
    .filter(Boolean)
    .slice(0, CLOSE_MORE_MAX);
  const total = packed.length + 2; // cover + bodies + close

  await renderOnePage(
    page,
    {
      kind: "cover",
      page: 1,
      total,
      title: stripVisibleUrlText(article.title_zh),
      subtitle: stripVisibleUrlText(article.excerpt_zh),
      seriesLabel: series,
      gwTag: gw,
      heroSrc,
    },
    join(dir, "01.png"),
  );

  for (let i = 0; i < packed.length; i++) {
    const name = String(i + 2).padStart(2, "0") + ".png";
    await renderOnePage(
      page,
      bodyPagePayload(article, packed[i]!, i + 2, total, series, gw),
      join(dir, name),
    );
  }

  const closeBase = {
    kind: "feed-close",
    page: total,
    total,
    title: "完整文章在 Faleague",
    subtitle: more.length
      ? "去 Scout 中文专栏看全文。下面这些未出现在封面。"
      : "去 Scout 中文专栏看全文、笔记和伤情。",
    seriesLabel: "Scout 中文",
    gwTag: gw,
  };
  let listed = [...more];
  while (listed.length > 0) {
    await page.evaluate((payload) => {
      (window as unknown as { renderPage: (d: unknown) => void }).renderPage(payload);
    }, withAssets({ ...closeBase, moreTitles: listed }));
    const overflow = await pageOverflow(page);
    if (overflow <= 16) break;
    listed.pop();
  }
  await renderOnePage(
    page,
    { ...closeBase, moreTitles: listed },
    join(dir, String(total).padStart(2, "0") + ".png"),
  );

  const caption = buildCaption(article, ctaDisplay);
  writeFileSync(join(dir, "caption.txt"), caption, "utf8");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        mode: "full-passage",
        theme: renderTheme ?? "faleague",
        slugs: [article.slug],
        titles: [stripVisibleUrlText(article.title_zh)],
        more_titles: listed,
        pages: total,
        cta_url: ctaDisplay,
        output: dir,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(
    JSON.stringify({
      ok: true,
      mode: "full-passage",
      pages: total,
      dir,
      slugs: [article.slug],
    }),
  );
  return {
    slug: stamp,
    pages: total,
    dir,
    titles: [stripVisibleUrlText(article.title_zh)],
  };
}

async function loadDbTranslated(): Promise<LocalScoutZh[]> {
  const { getServerSupabase } = await import("../lib/supabase");
  const { hasRealScoutZh } = await import("../lib/scout/zh-status");
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select(
      "slug,title_zh,title_en,excerpt_zh,excerpt_en,author,series,source_url,source_published_at,status,body_html_zh,translate_requested_at",
    )
    .order("source_published_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const out: LocalScoutZh[] = [];
  for (const row of data ?? []) {
    const title_en = String(row.title_en ?? "");
    const title_zh = String(row.title_zh ?? "");
    const body_html_zh = String(row.body_html_zh ?? "");
    if (
      !hasRealScoutZh({
        title_en,
        title_zh,
        body_html_zh,
        excerpt_zh: row.excerpt_zh ? String(row.excerpt_zh) : null,
      })
    ) {
      continue;
    }
    const mapped: LocalScoutZh = {
      slug: String(row.slug),
      dir: "",
      title_zh,
      excerpt_zh: String(row.excerpt_zh ?? ""),
      summary_zh: "",
      title_en,
      excerpt_en: row.excerpt_en ? String(row.excerpt_en) : null,
      author: row.author ? String(row.author) : null,
      series: String(row.series ?? "other"),
      source_url: String(row.source_url ?? ""),
      source_published_at: row.source_published_at
        ? String(row.source_published_at)
        : null,
      translate_requested_at: row.translate_requested_at
        ? String(row.translate_requested_at)
        : null,
      status: String(row.status ?? "pending"),
      body_html_zh,
      zh_mtime_ms: row.source_published_at
        ? Date.parse(String(row.source_published_at))
        : 0,
    };
    if (skipReasonFor(mapped)) continue;
    out.push(mapped);
  }
  return out;
}

function mergeZhSources(
  local: LocalScoutZh[],
  db: LocalScoutZh[],
): LocalScoutZh[] {
  const bySlug = new Map<string, LocalScoutZh>();
  for (const a of db) bySlug.set(a.slug, a);
  for (const a of local) bySlug.set(a.slug, a);
  return [...bySlug.values()].sort(
    (a, b) => publishedAtMs(b) - publishedAtMs(a),
  );
}

async function loadRequestedSlugs(): Promise<string[]> {
  const { listScoutTranslateQueue } = await import("../lib/scout/store");
  const rows = await listScoutTranslateQueue();
  return rows.map((r) => r.slug);
}

async function main() {
  loadScriptEnv();
  const cta = resolveScoutCta(process.env.NEXT_PUBLIC_SITE_URL);
  ctaLabel = cta.label;
  ctaDisplay = cta.display;
  const logoPath = ffsLogoPath();
  logoSrc = existsSync(logoPath) ? pathToFileURL(logoPath).href : "";

  const dry = process.argv.includes("--dry");
  const force = process.argv.includes("--force");
  const requested = process.argv.includes("--requested");
  const fullPassage = process.argv.includes("--full-passage");
  const full = process.argv.includes("--full") && !fullPassage;
  const teaser = !full && !fullPassage;
  const themeRaw = flagStr("theme");
  renderTheme = themeRaw === "xhs" ? "xhs" : undefined;
  const slugs = parseSlugs();
  const latestRaw = flagStr("latest");
  const all = process.argv.includes("--all");
  const latest =
    latestRaw != null
      ? parseIntFlag("latest", teaser ? TEASER_MAX_ARTICLES : DEFAULT_LATEST)
      : slugs.length && !requested
        ? null
        : teaser
          ? TEASER_MAX_ARTICLES
          : DEFAULT_LATEST;
  const days =
    parseIntFlag(
      "days",
      slugs.length || requested || latestRaw != null || all ? 0 : teaser ? 21 : DEFAULT_DAYS,
    ) ?? (teaser ? 21 : DEFAULT_DAYS);

  const local = loadLocalScoutZh();
  let db: LocalScoutZh[] = [];
  try {
    db = await loadDbTranslated();
  } catch (err) {
    console.warn(
      JSON.stringify({
        warn: "db_translated_unavailable",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  const pool = mergeZhSources(local, db);
  let slugFilter = slugs;
  if (requested && !slugFilter.length) {
    slugFilter = await loadRequestedSlugs();
  }

  const picked = selectScoutXhsArticles(pool, {
    slugs: slugFilter.length ? slugFilter : undefined,
    latest: all ? 999 : (latest ?? (teaser ? TEASER_MAX_ARTICLES : DEFAULT_LATEST)),
    days: slugFilter.length || all ? 0 : days,
    force,
  });
  // Explicit slug batches larger than one cover auto-chunk into multiple feeds.
  const chunkBatch =
    all || (teaser && slugFilter.length > TEASER_MAX_ARTICLES);
  const cap = chunkBatch || fullPassage
    ? 999
    : teaser
      ? TEASER_MAX_ARTICLES
      : (latest ?? DEFAULT_LATEST);
  const selected =
    slugFilter.length
      ? picked.selected.slice(0, chunkBatch || fullPassage ? 999 : cap)
      : picked.selected.slice(0, cap);
  const skipped = picked.skipped;

  const summary = {
    mode: dry ? "dry" : fullPassage ? "full-passage" : teaser ? "teaser" : "render",
    theme: renderTheme ?? "faleague",
    cta: { label: ctaLabel, url: ctaDisplay, href: cta.href },
    selected: selected.map((a) => a.slug),
    skipped: skipped.filter((s) => s.reason === "paywall" || s.reason === "not_found" || slugFilter.includes(s.slug)),
    skipped_paywall: skipped.filter((s) => s.reason === "paywall").map((s) => s.slug),
    count: selected.length,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (dry || selected.length === 0) return;

  const outRoot = scoutXhsOutRoot();
  mkdirSync(outRoot, { recursive: true });

  const browser = await chromium.launch();
  const results: { slug: string; pages: number; dir: string }[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: XHS_WIDTH, height: XHS_HEIGHT },
      deviceScaleFactor: 2,
    });
    await page.goto(pathToFileURL(templatePath).href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitTemplateReady(page);
    try {
      await page.waitForLoadState("networkidle", { timeout: 8000 });
    } catch {
      /* fonts optional */
    }

    if (fullPassage) {
      const prefer =
        slugFilter.find((s) => selected.some((a) => a.slug === s)) ?? selected[0]!.slug;
      const main = selected.find((a) => a.slug === prefer) ?? selected[0]!;
      const moreTitles = closePageMoreTitles([main], selected, pool, {
        days: 21,
        max: CLOSE_MORE_MAX,
      });
      results.push(
        await generateFullPassageFeed(
          page,
          main,
          outRoot,
          feedStamp(1, { all: false, outRoot, theme: renderTheme }),
          moreTitles,
        ),
      );
    } else if (teaser) {
      const groups = chunkBatch
        ? chunkArticles(selected, TEASER_MAX_ARTICLES)
        : [selected];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        if (!group.length) continue;
        // Prefer other titles from this batch that are not on this cover.
        const moreTitles = closePageMoreTitles(group, selected, pool, {
          days: 21,
          max: CLOSE_MORE_MAX,
        });
        results.push(
          await generateTeaserFeed(
            page,
            group,
            outRoot,
            feedStamp(i + 1, {
              all: chunkBatch || all,
              outRoot,
              theme: renderTheme,
            }),
            moreTitles,
          ),
        );
      }
    } else {
      for (const article of selected) {
        results.push(await generateArticle(page, article, outRoot));
      }
    }
    await page.close();
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(outRoot, "index.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        cta: { label: ctaLabel, url: ctaDisplay, href: cta.href },
        results,
        skipped_paywall: skipped.filter((s) => s.reason === "paywall").map((s) => s.slug),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        out: outRoot,
        results,
        skipped_paywall: skipped.filter((s) => s.reason === "paywall").map((s) => s.slug),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
