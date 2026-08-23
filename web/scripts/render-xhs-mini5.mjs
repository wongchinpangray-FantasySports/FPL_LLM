#!/usr/bin/env node
/**
 * Render Xiaohongshu (小红书) 3:4 promo poster for Mini 5.
 *
 *   cd web && node scripts/render-xhs-mini5.mjs
 *
 * Output:
 *   output/xhs/mini5-{date}.json
 *   output/xhs/mini5-{date}.png
 *   output/xhs/mini5-{date}-caption.txt
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatePath = join(__dirname, "wechat", "xhs-mini5.html");
const outDir = join(root, "output", "xhs");
const WIDTH = 1080;
const HEIGHT = 1440;

function todayStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildPayload(date) {
  return {
    kind: "mini5",
    date,
    eyebrow: "MINI 5 · LIVE NOW",
    chips: ["无预算限制", "FPL 官方积分", "每周任务"],
    title: "5人阵容，冲榜就在 FALEAGUE",
    titleHtml: `5人阵容，<span class="accent">冲榜就在 FALEAGUE</span>`,
    subtitle: "一键开玩 FALEAGUE Mini 5 —— 选5人、定队长、打赛季榜，还能组迷你联赛。",
    pitchLabel: "MINI 5 · SAMPLE SQUAD",
    row1: [
      { pos: "MID", name: "Palmer", team: "CHE", pts: "0", form: "6.8", own: "42%", cap: false },
      { pos: "FWD", name: "Isak", team: "NEW", pts: "0", form: "7.2", own: "38%", cap: false },
    ],
    row2: [
      { pos: "DEF", name: "Gabriel", team: "ARS", pts: "0", form: "5.4", own: "28%", cap: false },
      { pos: "MID", name: "Stach", team: "LEE", pts: "0", form: "5.1", own: "8%", cap: true },
    ],
    gk: { pos: "GKP", name: "Raya", team: "ARS", pts: "0", form: "4.8", own: "31%", cap: false },
    features: [
      {
        kicker: "01 RULES",
        title: "5人轻量规则",
        body: "1门将 + 4场外，同俱乐部最多2人。无预算，专注选人与队长。",
      },
      {
        kicker: "02 MISSION",
        title: "每周任务",
        body: "带冷门、冷门队长、五支球队……完成即领徽章。",
      },
      {
        kicker: "03 SOCIAL",
        title: "冲榜 & 联赛",
        body: "实时积分榜、赛季累计，还能拉朋友开迷你联赛。",
      },
    ],
    steps: [
      { title: "选5人", body: "模板一键开局" },
      { title: "定队长", body: "可冲冷门 +2" },
      { title: "保存冲榜", body: "截止前提交" },
    ],
    rewardPlus: "+2",
    rewardTitle: "常驻奖励：冷门队长",
    rewardBody: "队长选择 ≤10% 持有球员，出场即可多得 +2 Mini 分。",
    cta: "立刻开玩 Mini 5 →",
    url: "faleague-ai.com/zh/play/mini",
  };
}

function buildCaption(data) {
  return [
    "⚽ Mini 5 上线了！",
    "",
    "还在纠结 15 人阵容？先来一盘 5 人冲榜——",
    "✅ 无预算限制",
    "✅ FPL 官方积分 + 队长规则",
    "✅ 每周任务 / 徽章 / 迷你联赛",
    "✅ 冷门队长常驻 +2 分",
    "",
    "新赛季开玩就现在，点进链接组队：",
    `👉 https://${data.url}`,
    "",
    "#FPL #FantasyPremierLeague #Mini5 #英超 #范特西足球 #FALEAGUE",
  ].join("\n");
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const date = todayStamp();
  const data = buildPayload(date);
  const caption = buildCaption(data);

  const jsonPath = join(outDir, `mini5-${date}.json`);
  const pngPath = join(outDir, `mini5-${date}.png`);
  const captionPath = join(outDir, `mini5-${date}-caption.txt`);

  writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  writeFileSync(captionPath, caption, "utf8");
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${captionPath}`);

  const html = readFileSync(templatePath, "utf8");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 2,
    });
    const injected = html.replace(
      "if (window.__DATA__) render(window.__DATA__);",
      `window.__DATA__ = ${JSON.stringify(data)}; render(window.__DATA__);`,
    );
    await page.setContent(injected, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await page.screenshot({ path: pngPath, type: "png" });
    await page.close();
    console.log(`Wrote ${pngPath}`);
  } finally {
    await browser.close();
  }

  console.log("\n--- XHS caption ---\n");
  console.log(caption);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
