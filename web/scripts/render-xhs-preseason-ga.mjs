#!/usr/bin/env node
/**
 * Render Xiaohongshu preseason G/A club summary posters (2 pages).
 *
 *   cd web && npx tsx scripts/build-xhs-preseason-ga.ts
 *   cd web && node scripts/render-xhs-preseason-ga.mjs
 *
 * Output:
 *   output/xhs/preseason-ga-{date}-p1.png
 *   output/xhs/preseason-ga-{date}-p2.png
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatePath = join(__dirname, "wechat", "xhs-preseason-ga.html");
const outDir = join(root, "output", "xhs");
const WIDTH = 1080;
const HEIGHT = 1440;

function badgeUrl(teamCode) {
  if (!teamCode) return null;
  return `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`;
}

async function loadTeamBadges() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!res.ok) throw new Error(`FPL bootstrap failed: ${res.status}`);
  const data = await res.json();
  const byShort = new Map();
  for (const t of data.teams || []) {
    byShort.set(String(t.short_name).toUpperCase(), badgeUrl(t.code));
    // common aliases used in our JSON
    if (t.short_name === "NFO") byShort.set("NFO", badgeUrl(t.code));
    if (t.name?.includes("Spurs") || t.short_name === "TOT") {
      byShort.set("TOT", badgeUrl(t.code));
    }
  }
  return byShort;
}

function latestGaJson() {
  const files = readdirSync(outDir)
    .filter((f) => /^preseason-ga-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) return null;
  return join(outDir, files[files.length - 1]);
}

async function renderPage(browser, html, data, outPath) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  const injected = html.replace(
    "if (window.__DATA__) render(window.__DATA__);",
    `window.__DATA__ = ${JSON.stringify(data)}; render(window.__DATA__);`,
  );
  await page.setContent(injected, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: outPath, type: "png" });
  await page.close();
  console.log(`Wrote ${outPath}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = process.argv.find((a) => a.endsWith(".json")) || latestGaJson();
  if (!jsonPath || !existsSync(jsonPath)) {
    console.error("Missing preseason-ga JSON. Run: npx tsx scripts/build-xhs-preseason-ga.ts");
    process.exit(1);
  }
  const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
  const badges = await loadTeamBadges();
  const html = readFileSync(templatePath, "utf8");

  const enrich = (clubs) =>
    clubs.map((c) => ({
      ...c,
      badge: badges.get(String(c.pl_code).toUpperCase()) || c.badge || null,
    }));

  const browser = await chromium.launch();
  try {
    for (const page of payload.pages || []) {
      const data = {
        date: payload.date,
        page: page.page,
        total_pages: page.total_pages || payload.pages.length,
        subtitle: payload.subtitle,
        total_clubs: payload.total_clubs,
        total_goals: payload.total_goals,
        total_assists: payload.total_assists,
        clubs: enrich(page.clubs),
        cta: "打开季前赛信号 →",
        url: "faleague-ai.com/zh/fpl/insights/preseason-signals",
      };
      const outPath = join(
        outDir,
        `preseason-ga-${payload.date}-p${page.page}.png`,
      );
      await renderPage(browser, html, data, outPath);
      writeFileSync(
        join(outDir, `preseason-ga-${payload.date}-p${page.page}.json`),
        JSON.stringify(data, null, 2),
        "utf8",
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
