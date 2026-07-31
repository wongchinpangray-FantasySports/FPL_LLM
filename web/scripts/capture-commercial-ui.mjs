#!/usr/bin/env node
/**
 * Capture commercial UI clips + screenshots for FALEAGUE AI video production.
 *
 * Prerequisites:
 *   cd web && npm install
 *   npx playwright install chromium
 *
 * Auth (required for chat, planner, squad-builder, inbox):
 *   npm run capture:commercial -- --login
 *   # sign in once; session saved to scripts/commercial/.auth-state.json
 *
 * Or:
 *   CAPTURE_AUTH_EMAIL=... CAPTURE_AUTH_PASSWORD=... npm run capture:commercial
 *
 * Run:
 *   npm run capture:commercial
 *   CAPTURE_BASE_URL=http://localhost:3000 npm run capture:commercial
 *   npm run capture:commercial -- --locale zh
 *   npm run capture:commercial -- --screenshots-only
 *   npm run capture:commercial -- --login
 *   npm run capture:commercial -- --only squad-builder,historical,fixtures,preseason
 *
 * Env:
 *   CAPTURE_BASE_URL     default https://www.faleague-ai.com
 *   CAPTURE_LOCALE       en | zh | both (default both)
 *   CAPTURE_ENTRY_ID     optional FPL entry id for planner capture
 *   CAPTURE_AUTH_EMAIL   optional login email
 *   CAPTURE_AUTH_PASSWORD optional login password
 *   CAPTURE_CHAT_WAIT_MS max wait for AI reply (default 45000)
 *
 * Output:
 *   public/commercial/captures/{locale}/{UI-A..F|feature-*}.{png|webm}
 */

import { existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const authStatePath = join(__dirname, "commercial", ".auth-state.json");

const SHOT_ALIASES = {
  home: "UI-A-home",
  chat: "UI-B-chat",
  planner: "UI-C-planner",
  "squad-builder": "feature-squad-builder",
  squadbuilder: "feature-squad-builder",
  worldcup: "UI-E-worldcup",
  inbox: "UI-F-inbox",
  historical: "feature-historical",
  fixtures: "feature-fixtures",
  preseason: "feature-preseason",
};

const baseUrl = (process.env.CAPTURE_BASE_URL ?? "https://www.faleague-ai.com").replace(
  /\/$/,
  "",
);
const entryId = process.env.CAPTURE_ENTRY_ID?.trim() || null;
const chatWaitMs = Number(process.env.CAPTURE_CHAT_WAIT_MS ?? "45000");

const args = new Set(process.argv.slice(2));
const loginMode = args.has("--login");
const screenshotsOnly = args.has("--screenshots-only");
const localeArg = process.argv.find((a) => a.startsWith("--locale="))?.split("=")[1]
  ?? (args.has("--locale") ? process.argv[process.argv.indexOf("--locale") + 1] : null)
  ?? process.env.CAPTURE_LOCALE
  ?? "both";

const locales =
  localeArg === "both" ? ["en", "zh"] : [localeArg === "zh" ? "zh" : "en"];

const onlyArg = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1]
  ?? (args.has("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null);

const onlyIds = onlyArg
  ? new Set(
      onlyArg.split(",").map((key) => {
        const trimmed = key.trim().toLowerCase();
        return SHOT_ALIASES[trimmed] ?? trimmed;
      }),
    )
  : null;

function shouldCapture(id) {
  return !onlyIds || onlyIds.has(id);
}

const VIEWPORT = { width: 1920, height: 1080 };

const PROMPTS = {
  en: {
    chatQuestion: "Who should I captain this gameweek?",
    chatSuggestion: /Captain this GW/i,
  },
  zh: {
    chatQuestion: "本轮队长应该选谁？",
    chatSuggestion: /队长选谁/,
  },
};

function localePath(locale, path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en") return normalized;
  return normalized === "/" ? "/zh" : `/zh${normalized}`;
}

function outDirFor(locale) {
  const dir = join(root, "public", "commercial", "captures", locale);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function applyDarkModeInit(context) {
  await context.addInitScript(() => {
    document.documentElement.classList.add("dark");
    try {
      localStorage.setItem("theme", "dark");
    } catch {
      /* ignore */
    }
  });
}

async function applyDarkModePage(page) {
  await page.emulateMedia({ colorScheme: "dark" });
}

async function waitForAppShell(page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function dismissOverlays(page) {
  const dismiss = page.getByRole("button", { name: /Maybe later|稍后再说|Close|关闭/i });
  if (await dismiss.first().isVisible({ timeout: 1500 }).catch(() => false)) {
    await dismiss.first().click().catch(() => {});
    await page.waitForTimeout(400);
  }
}

async function setEntryId(page, id) {
  if (!id) return;
  await page.evaluate((value) => {
    try {
      localStorage.setItem("fpl_entry_id", value);
      window.dispatchEvent(new Event("fpl-entry-id-changed"));
    } catch {
      /* ignore */
    }
  }, id);
}

async function saveScreenshot(page, filePath) {
  await page.screenshot({ path: filePath, type: "png" });
  console.log(`  screenshot ${filePath}`);
}

async function finalizeVideo(page, context, outPath) {
  const video = page.video();
  await context.close();
  if (video) {
    await video.saveAs(outPath);
    console.log(`  video ${outPath}`);
  }
}

async function isLoginPage(page) {
  return page.url().includes("/auth/login");
}

async function recordOrScreenshot({
  browser,
  storageState,
  locale,
  id,
  url,
  durationMs,
  action,
  screenshotOnly,
}) {
  const outDir = outDirFor(locale);
  const pngPath = join(outDir, `${id}.png`);
  const webmPath = join(outDir, `${id}.webm`);

  const context = await browser.newContext({
    viewport: VIEWPORT,
    storageState,
    colorScheme: "dark",
    recordVideo: screenshotOnly
      ? undefined
      : { dir: outDir, size: VIEWPORT },
  });

  await applyDarkModeInit(context);
  const page = await context.newPage();
  await applyDarkModePage(page);

  if (entryId) await setEntryId(page, entryId);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForAppShell(page);
  await dismissOverlays(page);

  if (action) {
    try {
      await action(page);
    } catch (err) {
      const onLogin = await isLoginPage(page);
      console.warn(
        `  Action failed${onLogin ? " (login required)" : ""}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await saveScreenshot(page, pngPath);

  if (screenshotOnly) {
    await context.close();
    return;
  }

  await page.waitForTimeout(durationMs);
  await finalizeVideo(page, context, webmPath);
}

async function ensureAuth(browser, locale) {
  if (loginMode) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await applyDarkModeInit(context);
    const page = await context.newPage();
    await applyDarkModePage(page);
    const loginUrl = `${baseUrl}${localePath(locale, "/auth/login")}`;
    console.log(`Opening login page — sign in manually:\n  ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
    console.log("Waiting up to 3 minutes for redirect away from /auth/login …");
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
      timeout: 180_000,
    });
    await context.storageState({ path: authStatePath });
    await context.close();
    console.log(`Saved auth state → ${authStatePath}`);
    return authStatePath;
  }

  const email = process.env.CAPTURE_AUTH_EMAIL?.trim();
  const password = process.env.CAPTURE_AUTH_PASSWORD;
  if (email && password) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await applyDarkModeInit(context);
    const page = await context.newPage();
    await applyDarkModePage(page);
    await page.goto(`${baseUrl}${localePath(locale, "/auth/login")}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.getByRole("button", { name: /Sign in|登录/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
      timeout: 60_000,
    });
    await context.storageState({ path: authStatePath });
    await context.close();
    console.log(`Logged in and saved auth state → ${authStatePath}`);
    return authStatePath;
  }

  if (existsSync(authStatePath)) {
    return authStatePath;
  }

  console.warn(
    "No auth session — protected pages (chat, planner, squad-builder, inbox) may redirect to login.\n" +
      "  Run: npm run capture:commercial -- --login",
  );
  return undefined;
}

async function scrollPage(page, top = 280) {
  await page.evaluate((y) => window.scrollBy({ top: y, behavior: "smooth" }), top);
  await page.waitForTimeout(1200);
}

async function warnIfLogin(page, featureLabel) {
  if (await isLoginPage(page)) {
    console.warn(`  ${featureLabel} requires auth — run: npm run capture:commercial -- --login`);
    return true;
  }
  return false;
}

async function captureLocale(browser, locale) {
  console.log(`\n=== Locale: ${locale} ===`);
  const storageState = await ensureAuth(browser, locale);
  if (loginMode) {
    console.log("Login complete. Re-run without --login to capture.");
    return;
  }

  const prompts = PROMPTS[locale] ?? PROMPTS.en;

  console.log("\nUI-A Home hub");
  if (shouldCapture("UI-A-home")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "UI-A-home",
    url: `${baseUrl}${localePath(locale, "/")}`,
    durationMs: 4000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollBy({ top: 420, behavior: "smooth" }));
      await page.waitForTimeout(1800);
    },
  });
  }

  console.log("\nUI-B AI Chat");
  if (shouldCapture("UI-B-chat")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "UI-B-chat",
    url: `${baseUrl}${localePath(locale, "/chat")}`,
    durationMs: 5000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await isLoginPage(page)) {
        console.warn("  Chat requires auth — run: npm run capture:commercial -- --login");
        return;
      }
      const suggestion = page.getByRole("button", { name: prompts.chatSuggestion });
      if (await suggestion.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await suggestion.first().click();
      } else {
        const input = page.locator('input[placeholder]').last();
        await input.fill(prompts.chatQuestion);
        await page.getByRole("button", { name: /Send|发送/i }).click();
      }
      await page
        .locator(".prose")
        .last()
        .waitFor({ state: "visible", timeout: chatWaitMs })
        .catch(() => {
          console.warn("  Chat reply timed out — screenshot may show partial/empty reply.");
        });
      await page.waitForTimeout(800);
    },
  });
  }

  console.log("\nUI-C Planner");
  if (shouldCapture("UI-C-planner")) {
  const plannerPath = entryId
    ? localePath(locale, `/planner/${entryId}`)
    : localePath(locale, "/planner");
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "UI-C-planner",
    url: `${baseUrl}${plannerPath}`,
    durationMs: 4000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await isLoginPage(page)) {
        console.warn("  Planner requires auth.");
        return;
      }
      if (!entryId) {
        console.warn("  Set CAPTURE_ENTRY_ID for a loaded planner view.");
        return;
      }
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
      await page.waitForTimeout(1200);
    },
  });
  }

  console.log("\nSquad Builder");
  if (shouldCapture("feature-squad-builder")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "feature-squad-builder",
    url: `${baseUrl}${localePath(locale, "/squad-builder")}`,
    durationMs: 5000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await warnIfLogin(page, "Squad builder")) return;
      await page.waitForTimeout(2500);
      await scrollPage(page, 320);
      await page.waitForTimeout(800);
      await scrollPage(page, -180);
    },
  });
  }

  console.log("\nHistorical Data");
  if (shouldCapture("feature-historical")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "feature-historical",
    url: `${baseUrl}${localePath(locale, "/fpl/historical")}`,
    durationMs: 5000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await warnIfLogin(page, "Historical data")) return;
      await page.waitForTimeout(2800);
      await scrollPage(page, 360);
      const table = page.locator("table").first();
      if (await table.isVisible({ timeout: 3000 }).catch(() => false)) {
        await table.scrollIntoViewIfNeeded().catch(() => {});
      }
      await page.waitForTimeout(1000);
    },
  });
  }

  console.log("\nFixtures");
  if (shouldCapture("feature-fixtures")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "feature-fixtures",
    url: `${baseUrl}${localePath(locale, "/fpl/fixtures")}`,
    durationMs: 5000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await warnIfLogin(page, "Fixtures")) return;
      await page.waitForTimeout(2800);
      await scrollPage(page, 240);
      await page.waitForTimeout(900);
      await scrollPage(page, 240);
    },
  });
  }

  console.log("\nPreseason");
  if (shouldCapture("feature-preseason")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "feature-preseason",
    url: `${baseUrl}${localePath(locale, "/fpl/preseason")}`,
    durationMs: 5000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (await warnIfLogin(page, "Preseason")) return;
      await page.waitForTimeout(2800);
      const expand = page.locator("button").filter({ hasText: /.+/ }).first();
      if (await expand.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expand.click().catch(() => {});
        await page.waitForTimeout(900);
      }
      await scrollPage(page, 300);
    },
  });
  }

  console.log("\nUI-E World Cup xP");
  if (shouldCapture("UI-E-worldcup")) {
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "UI-E-worldcup",
    url: `${baseUrl}${localePath(locale, "/worldcup?tab=xp")}`,
    durationMs: 4000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      const xpTab = page.getByRole("button", { name: /xP|预期/i });
      if (await xpTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await xpTab.first().click().catch(() => {});
      }
      await page.waitForTimeout(2000);
    },
  });
  }

  console.log("\nUI-F Personal feed");
  if (shouldCapture("UI-F-inbox")) {
  const inboxUrl = `${baseUrl}${localePath(locale, "/inbox")}`;
  await recordOrScreenshot({
    browser,
    storageState,
    locale,
    id: "UI-F-inbox",
    url: inboxUrl,
    durationMs: 3000,
    screenshotOnly: screenshotsOnly,
    action: async (page) => {
      if (page.url().includes("/auth/login")) {
        console.warn("  Inbox requires auth — falling back to home personalise section.");
        await page.goto(`${baseUrl}${localePath(locale, "/")}`, {
          waitUntil: "domcontentloaded",
        });
        await waitForAppShell(page);
        await page.evaluate(() => {
          const nodes = [...document.querySelectorAll("h2, h3")];
          const target = nodes.find((n) =>
            /your football|你的足球|personal/i.test(n.textContent ?? ""),
          );
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        await page.waitForTimeout(1800);
      }
    },
  });
  }
}

async function main() {
  mkdirSync(join(root, "public", "commercial"), { recursive: true });

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Mode: ${screenshotsOnly ? "screenshots only" : "screenshots + video clips"}`);
  console.log(`Locales: ${locales.join(", ")}`);
  if (onlyIds) {
    console.log(`Only: ${[...onlyIds].join(", ")}`);
  }

  const browser = await chromium.launch({ headless: !loginMode });

  for (const locale of locales) {
    await captureLocale(browser, locale);
  }

  await browser.close();
  console.log("\nDone — files in public/commercial/captures/{locale}/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
