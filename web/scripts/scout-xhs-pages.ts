#!/usr/bin/env node
/**
 * Render Xiaohongshu 3:4 carousel PNGs from translated Scout articles.
 *
 * Default is a **teaser feed** (cover of titles + images, then one page per
 * article with a filled teaser + bottom image). Full-article carousels are
 * opt-in via `--full`.
 *
 *   cd web
 *   npx tsx scripts/scout-xhs-pages.ts
 *   npx tsx scripts/scout-xhs-pages.ts --slugs=a,b,c,d
 *   npx tsx scripts/scout-xhs-pages.ts --all
 *   npx tsx scripts/scout-xhs-pages.ts --full --slug=one-article
 *   npx tsx scripts/scout-xhs-pages.ts --dry
 *
 * After Cursor translate `--apply`, the writer also runs this teaser step
 * for the slugs just written (unless `--no-xhs`).
 */
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
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
  ffsLogoPath,
  gwTag,
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
  TEASER_MAX_ARTICLES,
  type LocalScoutZh,
  type ScoutXhsBlock,
} from "../lib/scout/xhs-pages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, "wechat", "xhs-scout-article.html");

/** Leave room for the FFS lockup + plain-text attribution footer (no CTA / URL). */
const BODY_MAX_HEIGHT = 800;

let logoSrc = "";
let ctaLabel = "";
let ctaDisplay = "";

function withAssets(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, logoSrc };
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
  await page.waitForTimeout(180);
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
  const heroSrc = pickHeroSrc(allBlocks);
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

function feedStamp(index = 1, { all = false } = {}): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (all) return `feed-all-${String(index).padStart(2, "0")}`;
  return index > 1 ? `feed-${y}${m}${day}-${index}` : `feed-${y}${m}${day}`;
}

async function generateTeaserFeed(
  page: import("playwright").Page,
  articles: LocalScoutZh[],
  outRoot: string,
  stamp: string,
): Promise<{ slug: string; pages: number; dir: string; titles: string[] }> {
  const cards = buildTeaserCards(articles, TEASER_MAX_ARTICLES);
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
      items: cards.map((c) => ({
        title: c.title_zh,
        heroSrc: c.heroSrc || logoSrc || "",
      })),
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
      heroSrc: card.heroSrc,
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

  await renderOnePage(
    page,
    {
      kind: "feed-close",
      page: total,
      total,
      title: "完整文章在 Faleague",
      subtitle: "去 Scout 中文专栏看全文、笔记和伤情。",
      seriesLabel: "Scout 中文",
      gwTag: gw,
    },
    join(dir, String(total).padStart(2, "0") + ".png"),
  );

  const caption = buildTeaserCaption(articles.slice(0, cards.length), ctaDisplay);
  writeFileSync(join(dir, "caption.txt"), caption, "utf8");
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        mode: "teaser",
        slugs: cards.map((c) => c.slug),
        titles,
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
  const full = process.argv.includes("--full");
  const teaser = !full;
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
  const cap = all
    ? 999
    : teaser
      ? TEASER_MAX_ARTICLES
      : (latest ?? DEFAULT_LATEST);
  const selected =
    slugFilter.length
      ? picked.selected.slice(0, all ? 999 : cap)
      : picked.selected.slice(0, cap);
  const skipped = picked.skipped;

  const summary = {
    mode: dry ? "dry" : teaser ? "teaser" : "render",
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

    if (teaser) {
      const groups = all
        ? chunkArticles(selected, TEASER_MAX_ARTICLES)
        : [selected];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i]!;
        if (!group.length) continue;
        results.push(
          await generateTeaserFeed(
            page,
            group,
            outRoot,
            feedStamp(i + 1, { all }),
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
