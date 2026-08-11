#!/usr/bin/env node
/**
 * Render Xiaohongshu (小红书) 3:4 promo poster for Recommended Squad launch.
 *
 *   cd web && node scripts/render-xhs-recommended-squad.mjs
 *
 * Output:
 *   output/xhs/recommended-squad-{date}.json
 *   output/xhs/recommended-squad-{date}.png
 *   output/xhs/recommended-squad-{date}-caption.txt
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const templatePath = join(__dirname, "wechat", "xhs-recommended-squad.html");
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
    kind: "recommended-squad",
    date,
    eyebrow: "RECOMMENDED SQUAD · LIVE NOW",
    chips: ["一次生成", "三套对比", "导入构建器"],
    title: "还在纠结开局阵？点几下就出队",
    titleHtml: `还在纠结开局阵？<span class="accent">点几下就出队</span>`,
    subtitle:
      "FALEAGUE 推荐阵容上线：选风格、排除大热、定目标 —— 一次给出最稳 / 均衡 / 最差分 三套方案。",
    styleLabel: "STYLE · 风格芯片",
    styles: [
      { label: "模板", on: false },
      { label: "均衡", on: true },
      { label: "差分", on: false },
      { label: "贵价堆叠", on: false },
      { label: "廉价支点", on: false },
    ],
    options: [
      {
        kind: "SAFE",
        title: "最稳",
        meta: "3-4-3",
        hot: false,
        captain: "Haaland",
        capLabel: "队长",
        xiLabel: "KEY NAMES",
        stats: [
          { lab: "Spend", val: "£100m" },
          { lab: "Avg%", val: "38%" },
          { lab: "Diffs", val: "6" },
        ],
        players: [
          { pos: "FWD", name: "Haaland", own: "74%" },
          { pos: "MID", name: "B.Fernandes", own: "48%" },
          { pos: "MID", name: "Szoboszlai", own: "44%" },
          { pos: "FWD", name: "João Pedro", own: "56%" },
          { pos: "DEF", name: "Gabriel", own: "27%" },
          { pos: "GKP", name: "Raya", own: "31%" },
        ],
        whys: ["高拥有核心更稳", "少踩冷门坑"],
        foot: "模板友好，开局少踩坑",
      },
      {
        kind: "BALANCED",
        title: "均衡",
        meta: "3-4-3 · 荐",
        hot: true,
        captain: "Palmer",
        capLabel: "队长",
        xiLabel: "KEY NAMES",
        stats: [
          { lab: "Spend", val: "£99.5m" },
          { lab: "Avg%", val: "24%" },
          { lab: "Diffs", val: "8" },
        ],
        players: [
          { pos: "MID", name: "Palmer", own: "—" },
          { pos: "FWD", name: "João Pedro", own: "56%" },
          { pos: "MID", name: "Mbeumo", own: "23%" },
          { pos: "MID", name: "Sarr", own: "—" },
          { pos: "DEF", name: "Senesi", own: "—" },
          { pos: "DEF", name: "Gabriel", own: "27%" },
        ],
        whys: ["xP 与性价比折中", "可直接导入微调"],
        foot: "默认推荐 · 最均衡",
      },
      {
        kind: "SPICY",
        title: "最差分",
        meta: "3-5-2",
        hot: false,
        captain: "Foden",
        capLabel: "队长",
        xiLabel: "KEY NAMES",
        stats: [
          { lab: "Spend", val: "£98.5m" },
          { lab: "Avg%", val: "12%" },
          { lab: "Diffs", val: "12" },
        ],
        players: [
          { pos: "MID", name: "Foden", own: "—" },
          { pos: "FWD", name: "Mateta", own: "—" },
          { pos: "MID", name: "Enzo", own: "—" },
          { pos: "MID", name: "Tavernier", own: "—" },
          { pos: "DEF", name: "Ballard", own: "—" },
          { pos: "GKP", name: "Roefs", own: "—" },
        ],
        whys: ["低拥有冲排名", "差分味最重"],
        foot: "冲排名用的差分味",
      },
    ],
    features: [
      {
        kicker: "01 CHIPS",
        title: "芯片点选",
        body: "风格 / 排除大热 / 开局目标，不用写长文。",
      },
      {
        kicker: "02 ×3",
        title: "三套对比",
        body: "最稳、均衡、最差分并排看，一眼选方向。",
      },
      {
        kicker: "03 BUILDER",
        title: "一键导入",
        body: "选中后直接打开阵容构建器微调。",
      },
    ],
    steps: [
      { title: "选风格", body: "可排除大热" },
      { title: "点生成", body: "一次出三套" },
      { title: "导入微调", body: "进构建器" },
    ],
    rewardPlus: "×3",
    rewardTitle: "一次生成 · 三套方案",
    rewardBody: "改芯片再生成，可换下一批对比阵容。",
    cta: "立刻试推荐阵容 →",
    url: "faleague-ai.com/zh/fpl/insights/recommended-squad",
  };
}

function buildCaption(data) {
  return [
    "🔥 FPL 开局阵不会选？",
    "",
    "FALEAGUE「推荐阵容」上线了 ——",
    "点几下芯片，一次给你 3 套对比方案：",
    "",
    "✅ 最稳 / 均衡 / 最差分",
    "✅ 可排除 Haaland、Bruno 等大热",
    "✅ 模板 · 差分 · 贵价 · 廉价支点任选",
    "✅ 一键导入阵容构建器微调",
    "",
    "季前备战就用它，少纠结多下场：",
    `👉 https://${data.url}`,
    "",
    "#FPL #FantasyPremierLeague #英超 #范特西足球 #开局阵容 #FALEAGUE #推荐阵容",
  ].join("\n");
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const date = todayStamp();
  const data = buildPayload(date);
  const caption = buildCaption(data);

  const jsonPath = join(outDir, `recommended-squad-${date}.json`);
  const pngPath = join(outDir, `recommended-squad-${date}.png`);
  const captionPath = join(outDir, `recommended-squad-${date}-caption.txt`);

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
