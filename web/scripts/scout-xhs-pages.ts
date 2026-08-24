#!/usr/bin/env node
/**
 * Render Xiaohongshu (小红书) 3:4 carousel PNGs from translated Scout articles.
 *
 *   cd web
 *   npx tsx scripts/scout-xhs-pages.ts
 *   npx tsx scripts/scout-xhs-pages.ts --slug=fpl-notes-iraola-on-szoboszlai-pen-wissa-back-to-his-best
 *   npx tsx scripts/scout-xhs-pages.ts --latest=5
 *   npx tsx scripts/scout-xhs-pages.ts --requested
 *   npx tsx scripts/scout-xhs-pages.ts --dry
 *
 * Default: recent local ZH (last 5 days), skip paywall leftovers, cap 8,
 * prioritize FPL Notes + GW1. Output: output/scout-xhs/<slug>/01.png …
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
  type LocalScoutZh,
  type ScoutXhsBlock,
} from "../lib/scout/xhs-pages";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = join(__dirname, "wechat", "xhs-scout-article.html");

/** Leave room for the FFS lockup + Faleague Scout CTA footer (no Premium QR). */
const BODY_MAX_HEIGHT = 780;

let logoSrc = "";
let ctaLabel = "";
let ctaDisplay = "";

function withAssets(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, logoSrc, ctaLabel, ctaUrl: ctaDisplay };
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
    title: article.title_zh,
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
      title: article.title_zh,
      subtitle: article.excerpt_zh,
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
  const slugs = parseSlugs();
  const latestRaw = flagStr("latest");
  const all = process.argv.includes("--all");
  const latest =
    latestRaw != null
      ? parseIntFlag("latest", DEFAULT_LATEST)
      : slugs.length && !requested
        ? null
        : DEFAULT_LATEST;
  const days =
    parseIntFlag(
      "days",
      slugs.length || requested || latestRaw != null ? 0 : DEFAULT_DAYS,
    ) ?? DEFAULT_DAYS;

  const local = loadLocalScoutZh();
  let slugFilter = slugs;
  if (requested && !slugFilter.length) {
    slugFilter = await loadRequestedSlugs();
  }

  const picked = selectScoutXhsArticles(local, {
    slugs: slugFilter.length ? slugFilter : undefined,
    latest: latest ?? DEFAULT_LATEST,
    days: slugFilter.length ? 0 : days,
    force,
  });
  const cap = all ? 999 : (latest ?? DEFAULT_LATEST);
  const selected =
    slugFilter.length && !requested
      ? picked.selected
      : picked.selected.slice(0, cap);
  const skipped = picked.skipped;

  const summary = {
    mode: dry ? "dry" : "render",
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

    for (const article of selected) {
      results.push(await generateArticle(page, article, outRoot));
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
