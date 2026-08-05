#!/usr/bin/env node
/**
 * Render output/wechat-daily/card.json as a portrait PNG for WeChat.
 *
 * Run after generate-wechat-daily-card.ts (or with existing card.json).
 */
import { readFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsonPath = join(root, "output", "wechat-daily", "card.json");
const htmlPath = join(__dirname, "wechat", "wechat-daily-card.html");
const outDir = join(root, "output", "wechat-daily");
const outPath = join(outDir, "card.png");

async function main() {
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run generate-wechat-daily-card.ts first.`);
  }

  const card = JSON.parse(readFileSync(jsonPath, "utf8"));
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1440 });
  await page.addInitScript((data) => {
    window.__CARD__ = data;
  }, card);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const height = await page.evaluate(() => {
    const el = document.querySelector(".card");
    return Math.max(1440, el ? el.scrollHeight + 40 : 1440);
  });

  await page.setViewportSize({ width: 1080, height });
  await page.screenshot({ path: outPath, type: "png", fullPage: true });
  await browser.close();

  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
