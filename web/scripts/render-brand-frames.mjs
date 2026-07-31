#!/usr/bin/env node
/**
 * Render brand-accurate end cards and Xiaohongshu covers as PNG.
 *
 * Run:
 *   cd web && npm run render:commercial-frames
 *
 * Output:
 *   public/commercial/end-card-en-16x9.png
 *   public/commercial/end-card-zh-16x9.png
 *   public/commercial/xhs-cover-en-3x4.png
 *   public/commercial/xhs-cover-zh-3x4.png
 */

import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(__dirname, "commercial", "brand-frames.html");
const outDir = join(root, "public", "commercial");

const FRAMES = [
  { id: "end-card-en-16x9", width: 1920, height: 1080 },
  { id: "end-card-zh-16x9", width: 1920, height: 1080 },
  { id: "xhs-cover-en-3x4", width: 1080, height: 1440 },
  { id: "xhs-cover-zh-3x4", width: 1080, height: 1440 },
];

async function main() {
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const frame of FRAMES) {
    const url = `${pathToFileURL(htmlPath).href}?frame=${encodeURIComponent(frame.id)}`;
    await page.setViewportSize({ width: frame.width, height: frame.height });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);

    const outPath = join(outDir, `${frame.id}.png`);
    await page.screenshot({ path: outPath, type: "png" });
    console.log(`Wrote ${outPath}`);
  }

  await browser.close();
  console.log("\nDone — 4 brand frames in public/commercial/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
