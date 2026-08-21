#!/usr/bin/env node
/**
 * Render Xiaohongshu carousel for FPL beginner guide.
 *
 *   cd web && npx tsx scripts/render-xhs-fpl-guide.ts
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";
import {
  buildGuidePosterCaption,
  buildGuidePosterPages,
} from "../lib/fpl/beginner-guide";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatePath = join(__dirname, "wechat", "xhs-fpl-guide.html");
const outDir = join(root, "output", "xhs");
const WIDTH = 1080;
const HEIGHT = 1440;

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function renderPage(browser: import("playwright").Browser, data: object, outPath: string) {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 2,
  });
  await page.addInitScript((payload) => {
    (window as unknown as { __DATA__: object }).__DATA__ = payload;
  }, data);
  await page.goto(pathToFileURL(templatePath).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath, type: "png" });
  await page.close();
  console.log(`Wrote ${outPath}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const date = todayStamp();
  const pages = buildGuidePosterPages(date);
  const caption = buildGuidePosterCaption(date);

  const jsonPath = join(outDir, `fpl-guide-${date}.json`);
  const captionPath = join(outDir, `fpl-guide-${date}-caption.txt`);
  writeFileSync(jsonPath, JSON.stringify({ date, pages, caption }, null, 2), "utf8");
  writeFileSync(captionPath, caption, "utf8");
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${captionPath}`);

  const browser = await chromium.launch();
  try {
    for (const p of pages) {
      const outPath = join(outDir, `fpl-guide-${date}-p${p.page}.png`);
      await renderPage(browser, { ...p, date }, outPath);
    }
  } finally {
    await browser.close();
  }

  console.log("\n--- XHS caption ---\n");
  console.log(caption);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
