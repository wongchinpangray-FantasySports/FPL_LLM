#!/usr/bin/env node
/**
 * Render themed drafts: pitch-{id}.png + rationale-{id}.png
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "output", "gw1-draft");

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
  mkdirSync(outDir, { recursive: true });

  const packPath = join(outDir, "pack.json");
  let drafts = [];
  if (existsSync(packPath)) {
    drafts = JSON.parse(readFileSync(packPath, "utf8"));
  } else {
    const files = readdirSync(outDir).filter((f) => /^draft-.+\.json$/.test(f));
    for (const f of files) {
      drafts.push(JSON.parse(readFileSync(join(outDir, f), "utf8")));
    }
    if (!drafts.length && existsSync(join(outDir, "draft.json"))) {
      drafts = [JSON.parse(readFileSync(join(outDir, "draft.json"), "utf8"))];
    }
  }

  if (!drafts.length) {
    throw new Error(`No drafts in ${outDir} — run generate-gw1-draft.ts first.`);
  }

  for (const draft of drafts) {
    const id = draft.theme?.id ?? "template";
    await shot(
      join(__dirname, "wechat", "gw1-draft-pitch.html"),
      join(outDir, `pitch-${id}.png`),
      draft,
      "zh",
    );
    await shot(
      join(__dirname, "wechat", "gw1-draft-rationale.html"),
      join(outDir, `rationale-${id}.png`),
      draft,
      "zh",
    );
  }

  // Alias primary outputs
  const primary = drafts[0];
  if (primary) {
    const id = primary.theme?.id ?? "template";
    const { copyFileSync } = await import("fs");
    copyFileSync(join(outDir, `pitch-${id}.png`), join(outDir, "pitch.png"));
    copyFileSync(
      join(outDir, `rationale-${id}.png`),
      join(outDir, "rationale.png"),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
