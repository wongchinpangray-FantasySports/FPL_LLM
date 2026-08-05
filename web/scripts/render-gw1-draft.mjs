#!/usr/bin/env node
/**
 * Render output/gw1-draft/draft.json → pitch.png + rationale.png
 */
import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "output", "gw1-draft");
const jsonPath = join(outDir, "draft.json");

async function shot(htmlPath, outPath, draft, locale) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1620 });
  await page.addInitScript(
    ({ data, loc }) => {
      window.__DRAFT__ = data;
      window.__LOCALE__ = loc;
    },
    { data: draft, loc: locale },
  );
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const height = await page.evaluate(() => {
    const el = document.querySelector(".card");
    return Math.max(1440, el ? el.scrollHeight + 24 : 1440);
  });
  await page.setViewportSize({ width: 1080, height });
  await page.screenshot({ path: outPath, type: "png", fullPage: true });
  await browser.close();
  console.log(`Wrote ${outPath}`);
}

async function main() {
  if (!existsSync(jsonPath)) {
    throw new Error(`Missing ${jsonPath} — run generate-gw1-draft.ts first.`);
  }
  const draft = JSON.parse(readFileSync(jsonPath, "utf8"));
  mkdirSync(outDir, { recursive: true });

  await shot(
    join(__dirname, "wechat", "gw1-draft-pitch.html"),
    join(outDir, "pitch.png"),
    draft,
    "zh",
  );
  await shot(
    join(__dirname, "wechat", "gw1-draft-rationale.html"),
    join(outDir, "rationale.png"),
    draft,
    "zh",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
