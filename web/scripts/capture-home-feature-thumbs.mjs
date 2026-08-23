#!/usr/bin/env node
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "home-features");
const authStatePath = join(__dirname, "commercial", ".auth-state.json");
const baseUrl = (process.env.CAPTURE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const locale = process.env.CAPTURE_LOCALE === "en" ? "en" : "zh";
const OUT = { width: 960, height: 600 };
const VIEW = { width: 1400, height: 900 };

function lp(path) {
  if (locale === "en") return path;
  return path === "/" ? "/zh" : `/zh${path}`;
}

async function shot(page, clip, name) {
  const raw = join(outDir, `${name}.raw.png`);
  const out = join(outDir, `${name}.png`);
  const c = {
    x: Math.max(0, Math.floor(clip.x)),
    y: Math.max(0, Math.floor(clip.y)),
    width: Math.max(80, Math.min(VIEW.width - Math.max(0, Math.floor(clip.x)), Math.floor(clip.width))),
    height: Math.max(80, Math.min(VIEW.height - Math.max(0, Math.floor(clip.y)), Math.floor(clip.height))),
  };
  await page.screenshot({ path: raw, type: "png", clip: c });
  await sharp(raw)
    .resize(OUT.width, OUT.height, { fit: "cover", position: "centre" })
    .png({ compressionLevel: 8 })
    .toFile(out);
  unlinkSync(raw);
  console.log(`✓ ${name}`, c);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEW,
    colorScheme: "dark",
    deviceScaleFactor: 1.5,
    storageState: existsSync(authStatePath) ? authStatePath : undefined,
  });
  await context.addInitScript(() => {
    document.documentElement.classList.add("dark");
    try {
      localStorage.setItem("theme", "dark");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: "dark" });

  // —— players ——
  await page.goto(`${baseUrl}${lp("/players")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: /Haaland/i }).first().waitFor({ timeout: 45_000 });
  await page.waitForTimeout(600);
  await page.locator("table").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  let box = await page.locator("table").first().boundingBox();
  if (!box) throw new Error("players table missing");
  await shot(
    page,
    { x: box.x - 12, y: Math.max(0, box.y - 100), width: Math.min(1100, box.width + 36), height: 540 },
    "players",
  );

  // —— historical ——
  await page.goto(`${baseUrl}${lp("/fpl/historical")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.locator("select").first().selectOption("2025").catch(() => {});
  await page.getByRole("button", { name: /应用筛选|Apply/i }).click();
  await page.getByRole("button", { name: /Haaland/i }).first().waitFor({ timeout: 45_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const histTable = page.locator("table").first();
  await histTable.scrollIntoViewIfNeeded();
  box = await histTable.boundingBox();
  if (box) {
    await shot(
      page,
      { x: box.x - 10, y: Math.max(0, box.y - 120), width: Math.min(1120, box.width + 28), height: 540 },
      "historical",
    );
  }

  // —— insights ——
  await page.goto(`${baseUrl}${lp("/fpl/insights")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  const clipI = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /赛季备战|Season prep/i.test(el.textContent ?? ""),
    );
    const r = h?.getBoundingClientRect();
    return r
      ? { x: 36, y: Math.max(0, r.y - 4), width: 1140, height: 520 }
      : { x: 36, y: 150, width: 1140, height: 520 };
  });
  await shot(page, clipI, "insights");

  // —— mini5 ——
  await page.goto(`${baseUrl}${lp("/mini")}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const clipM = await page.evaluate(() => {
    const t = [...document.querySelectorAll("h2, h3, p, div")].find((el) =>
      /^新手模板|Templates$/i.test((el.textContent ?? "").trim().slice(0, 12)),
    );
    if (t) t.scrollIntoView({ block: "start" });
    const root = t?.closest("section") ?? t?.parentElement;
    const r = root?.getBoundingClientRect();
    if (r) {
      return {
        x: Math.max(0, r.x - 4),
        y: Math.max(0, r.y - 4),
        width: Math.min(1140, r.width + 12),
        height: 540,
      };
    }
    return { x: 70, y: 280, width: 1140, height: 540 };
  });
  await page.waitForTimeout(400);
  await shot(page, clipM, "mini5");

  // —— recommended ——
  await page.goto(`${baseUrl}${lp("/fpl/insights/recommended-squad")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2500);
  const gen = page.getByRole("button", { name: /生成 3 套阵容|Generate/i });
  if (await gen.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await gen.click();
    await page
      .getByRole("heading", { name: /三套方案|Three/i })
      .waitFor({ timeout: 60_000 })
      .catch(() => {});
    await page.waitForTimeout(900);
    await page
      .getByRole("heading", { name: /三套方案|Three/i })
      .scrollIntoViewIfNeeded()
      .catch(() => {});
  }
  const clipR = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((el) =>
      /三套方案|Three/i.test(el.textContent ?? ""),
    );
    const root = h?.closest("section") ?? h?.parentElement;
    const r = root?.getBoundingClientRect();
    if (r) {
      return {
        x: Math.max(0, r.x),
        y: Math.max(0, r.y),
        width: Math.min(1220, r.width),
        height: Math.min(600, Math.max(500, r.height)),
      };
    }
    // fallback: style chips area
    return { x: 40, y: 180, width: 1200, height: 520 };
  });
  await shot(page, clipR, "recommended-squad");

  // —— squad-builder ——
  await page.goto(`${baseUrl}${lp("/squad-builder")}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /球场|Pitch/i }).click().catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, { x: 20, y: 130, width: 780, height: 520 }, "squad-builder");

  await browser.close();
  console.log("Done — zoomed thumbs written.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
