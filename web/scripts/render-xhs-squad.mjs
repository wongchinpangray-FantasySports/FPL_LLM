#!/usr/bin/env node
/**
 * Render recommended-squad XHS posters (pitch + list).
 *
 *   cd web && node scripts/render-xhs-squad.mjs
 *
 * Output:
 *   output/xhs/squad-pitch-2026-08-09.png
 *   output/xhs/squad-list-2026-08-09.png
 *   output/xhs/squad-why-YYYY-MM-DD.png
 *   output/xhs/squad-why-YYYY-MM-DD-{def,mid,fwd,bench}.png
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "output", "xhs");
const WIDTH = 1080;
const HEIGHT = 1440;
const CARD_DATE = "2026-08-20";

/**
 * Balanced 3-5-2 from Squad Builder screenshot (draft 1).
 * Mbeumo (C) · Raya · Isak · João Pedro · five-man midfield.
 */
const SQUAD = {
  formation: "3-5-2",
  label_zh: "3-5-2 均衡阵",
  label_en: "Balanced 3-5-2",
  /** Filled after XP enrich if omitted. */
  xi_xp: null,
  starters: [
    { fpl_id: 1, web_name: "Raya", position: "GKP" },
    { fpl_id: 8, web_name: "Calafiori", position: "DEF" },
    { fpl_id: 418, web_name: "Maguire", position: "DEF" },
    { fpl_id: 534, web_name: "Hume", position: "DEF" },
    { fpl_id: 427, web_name: "Mbeumo", position: "MID", is_captain: true },
    { fpl_id: 40, web_name: "Rogers", position: "MID" },
    { fpl_id: 557, web_name: "Tzolis", position: "MID" },
    { fpl_id: 367, web_name: "Gakpo", position: "MID" },
    { fpl_id: 397, web_name: "Semenyo", position: "MID" },
    { fpl_id: 165, web_name: "João Pedro", position: "FWD" },
    { fpl_id: 379, web_name: "Isak", position: "FWD" },
  ],
  bench: [
    { fpl_id: 109, web_name: "Verbruggen", position: "GKP" },
    { fpl_id: 88, web_name: "Kayode", position: "DEF" },
    { fpl_id: 305, web_name: "Davis", position: "DEF" },
    { fpl_id: 346, web_name: "Calvert-Lewin", position: "FWD" },
  ],
  why: [
    "3-5-2 均衡开局：后防三小 + 五中场堆叠出场与进攻覆盖，锋线 Isak / João Pedro 双核。",
    "队长 Mbeumo 锁 Brentford 进攻天花板；Rogers · Gakpo · Semenyo 补创造与进球威胁。",
    "Tzolis 控价中场位腾预算；Calafiori / Maguire / Hume 功能型后防，Raya 顶门将。",
    "替补 Verbruggen · Kayode · Davis · Calvert-Lewin 覆盖轮换与伤停，留 £6.0m 银行灵活补入。",
  ],
  /** Two short sentences per player for the analysis poster. */
  playerWhy: {
    1: "Arsenal 主力门将，零封与 save 分双线稳定。£6.0m 顶门将位，后防三小更需要可靠最后一道屏障。",
    8: "Arsenal 进攻型边卫，助攻与 xGI 上限在。和 Raya 同队叠赛程，第三后卫位兼顾出场与上限。",
    418: "Man Utd 中卫模板，出场与 DEFCON 相对稳。£5.0m 功能型中卫，给五中场留预算空间。",
    534: "Sunderland 廉价边卫，£4.5m 控价第三后卫。伤停轮换与替补覆盖都够用，不抢进攻预算。",
    427: "本套队长：Brentford 进攻核心，点球 + 射门威胁明确。3-5-2 里用队长位押中场最高分位。",
    40: "Aston Villa 创造型中场，季前状态在线。五中场之一，补助攻与关键传球覆盖。",
    557: "Brentford 中场，价格友好、出场稳定。第四中场用来控价，而不是再堆一个 £8m+ 热门。",
    367: "Liverpool 前场多功能点，进球助攻都能贡献。和 Isak 不同队，分散赛程风险。",
    397: "Bournemouth 进攻中场，射门与 xG 都不低。五中场里补一个偏向前场的得分威胁。",
    165: "Chelsea 锋线第三点，和 Rogers 等同队可叠部分进攻回合。£7.5m 前锋位平衡 Isak 贵价。",
    379: "全队最贵前锋，纽卡进攻天花板。和 João Pedro 组成双锋，承担主要进球预期。",
    109: "替补门将，避免单门将伤停。Brighton 赛程有零封窗口，£4.5m 板凳标配。",
    88: "Brentford 廉价边卫，和 Mbeumo / Tzolis 同队方便一起看。伤停时顶后防轮换。",
    305: "Ipswich 中卫，£4.0m 最省替补后防。伤停补位用，不占首发预算。",
    346: "Everton 前锋替补，伤停时可顶锋线。£6.0m 比再买一个贵价前锋更灵活。",
  },
};

function loadEnv(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[m[1]] = v;
  }
  return env;
}

function shirtUrl(teamCode, position, size = 220) {
  if (teamCode == null) {
    return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_0-${size}.webp`;
  }
  const gk = position === "GKP" ? "_1" : "";
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}${gk}-${size}.webp`;
}

function photoUrl(code) {
  if (!code) return null;
  const id = String(code).replace(/^p/i, "");
  // 26/27 official PL portraits live under premierleague25, without the "p" prefix.
  return `https://resources.premierleague.com/premierleague25/photos/players/110x140/${id}.png`;
}

function photoLegacyUrl(code) {
  if (!code) return null;
  const id = String(code).replace(/^p/i, "");
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${id}.png`;
}

function normName(s) {
  return String(s || "")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadPreseasonGa() {
  const path = join(root, "data", "epl-preseason-2627.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  /** @type {Map<string, {goals:number, assists:number}>} */
  const byNorm = new Map();
  for (const match of data.matches || []) {
    if (match.status !== "finished") continue;
    for (const g of match.goals || []) {
      if (g.side !== "pl") continue;
      const bump = (name, field) => {
        if (!name) return;
        const key = normName(name);
        const row = byNorm.get(key) || { goals: 0, assists: 0 };
        row[field] += 1;
        byNorm.set(key, row);
      };
      bump(g.scorer, "goals");
      bump(g.assist, "assists");
    }
  }
  return byNorm;
}

function matchPreseason(byNorm, webName, fullName) {
  const web = normName(webName);
  const full = normName(fullName);
  if (web && byNorm.has(web)) return byNorm.get(web);
  if (full && byNorm.has(full)) return byNorm.get(full);

  for (const [k, v] of byNorm) {
    if (web && (k === web || k.endsWith(` ${web}`) || web.endsWith(` ${k}`))) {
      return v;
    }
    if (full && (k === full || k.endsWith(` ${full}`) || full.endsWith(` ${k}`))) {
      return v;
    }
  }
  return null;
}

function pitchStat(position, pre) {
  if (position === "GKP") {
    // No preseason saves in data yet
    return "-";
  }
  if (position === "DEF") {
    // No preseason DC in data yet
    return "-";
  }
  if (!pre) return "- / -";
  return `${pre.goals} / ${pre.assists}`;
}

function listKeyStat(position, db) {
  if (position === "GKP") {
    return db?.saves != null ? String(db.saves) : "—";
  }
  if (position === "DEF") {
    return db?.defensive_contribution != null
      ? String(db.defensive_contribution)
      : "—";
  }
  const g = db?.goals_scored ?? 0;
  const a = db?.assists ?? 0;
  return `${g}-${a}`;
}

async function loadBootstrap() {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!res.ok) throw new Error(`bootstrap ${res.status}`);
  return res.json();
}

async function loadFixtures() {
  const res = await fetch("https://fantasy.premierleague.com/api/fixtures/");
  if (!res.ok) throw new Error(`fixtures ${res.status}`);
  return res.json();
}

async function loadDbRows(ids) {
  const env = loadEnv(join(root, ".env.local"));
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new Map();
  const s = createClient(url, key);
  const { data, error } = await s
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,position,base_price,selected_by_percent,form,points_per_game,goals_scored,assists,clean_sheets,saves,defensive_contribution,defensive_contribution_per_90,expected_goals,expected_assists,minutes,status,threat",
    )
    .in("fpl_id", ids);
  if (error) {
    console.warn("DB load failed:", error.message);
    return new Map();
  }
  return new Map((data || []).map((r) => [r.fpl_id, r]));
}

function nextFixtureLabel(element, teamsById, fixtures, teamShort) {
  const teamId = element.team;
  const upcoming = fixtures
    .filter(
      (f) =>
        !f.finished &&
        (f.team_h === teamId || f.team_a === teamId) &&
        f.event != null,
    )
    .sort((a, b) => (a.event ?? 99) - (b.event ?? 99) || String(a.kickoff_time).localeCompare(String(b.kickoff_time)));
  const f = upcoming[0];
  if (!f) return "—";
  const home = f.team_h === teamId;
  const oppId = home ? f.team_a : f.team_h;
  const opp = teamsById.get(oppId)?.short_name || "?";
  return `${opp} (${home ? "H" : "A"})`;
}

function enrichSlot(slot, bootstrap, fixtures, dbMap, preByNorm) {
  const el = bootstrap.elements.find((e) => e.id === slot.fpl_id);
  if (!el) throw new Error(`Missing FPL element ${slot.fpl_id} ${slot.web_name}`);
  const teamsById = new Map(bootstrap.teams.map((t) => [t.id, t]));
  const team = teamsById.get(el.team);
  const db = dbMap.get(slot.fpl_id);
  const pre = matchPreseason(preByNorm, el.web_name, `${el.first_name} ${el.second_name}`);
  const position =
    ({ 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" })[el.element_type] || slot.position;
  const shirt = shirtUrl(team?.code, position);

  return {
    ...slot,
    web_name: el.web_name,
    position,
    team: team?.name || db?.team || "",
    team_short: team?.short_name || "",
    price: (el.now_cost ?? 0) / 10,
    selected_by_percent: Number(el.selected_by_percent ?? db?.selected_by_percent ?? 0),
    expected_goals: Number(db?.expected_goals ?? el.expected_goals ?? 0),
    expected_assists: Number(db?.expected_assists ?? el.expected_assists ?? 0),
    goals_scored: Number(db?.goals_scored ?? el.goals_scored ?? 0),
    assists: Number(db?.assists ?? el.assists ?? 0),
    defensive_contribution: Number(
      db?.defensive_contribution ?? el.defensive_contribution ?? 0,
    ),
    saves: Number(db?.saves ?? el.saves ?? 0),
    fixture: nextFixtureLabel(el, teamsById, fixtures, team?.short_name),
    shirt_url: shirt,
    photo_url: photoUrl(el.code) || shirt,
    photo_legacy: photoLegacyUrl(el.code),
    photo_kind: el.code ? "photo" : "shirt",
    preseason_goals: pre?.goals ?? null,
    preseason_assists: pre?.assists ?? null,
    stat_display: pitchStat(position, pre),
    stat_col: listKeyStat(position, {
      saves: db?.saves ?? el.saves,
      defensive_contribution:
        db?.defensive_contribution ?? el.defensive_contribution,
      goals_scored: db?.goals_scored ?? el.goals_scored,
      assists: db?.assists ?? el.assists,
    }),
  };
}

function loadExplorerStats() {
  const path = join(outDir, "squad-explorer-stats.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function mergeExplorerStats(player, statsById) {
  const s = statsById?.[player.fpl_id];
  if (!s) {
    return {
      ...player,
      xp_total: null,
      expected_minutes_next: null,
      value_per_million: null,
      goals: player.goals_scored ?? null,
      assists: player.assists ?? null,
      threat: null,
      xg_per_90: null,
      xa_per_90: null,
      dc_per_90: null,
      gw_run: [],
    };
  }
  return {
    ...player,
    xp_total: s.xp_total,
    expected_minutes_next: s.expected_minutes_next,
    value_per_million: s.value_per_million,
    goals: s.goals,
    assists: s.assists,
    threat: s.threat,
    xg_per_90: s.xg_per_90,
    xa_per_90: s.xa_per_90,
    dc_per_90: s.dc_per_90,
    selected_by_percent: s.ownership ?? player.selected_by_percent,
    price: s.price ?? player.price,
    team: s.team ?? player.team,
    gw_run: Array.isArray(s.gw_run) ? s.gw_run : [],
  };
}

async function renderPoster(browser, htmlPath, data, outPath) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.addInitScript((payload) => {
    window.__SQUAD__ = payload;
  }, data);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  try {
    await page.waitForFunction(
      () => {
        const imgs = [...document.images];
        if (!imgs.length) return true;
        return imgs.every((img) => img.complete && img.naturalWidth > 0);
      },
      { timeout: 20000 },
    );
  } catch {
    // continue even if some assets fail
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: outPath,
    type: "png",
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  await page.close();
  console.log(`Wrote ${outPath}`);
}

async function main() {
  mkdirSync(outDir, { recursive: true });

  console.log("Loading bootstrap, fixtures, DB, preseason…");
  const [bootstrap, fixtures, dbMap] = await Promise.all([
    loadBootstrap(),
    loadFixtures(),
    loadDbRows([
      ...SQUAD.starters.map((p) => p.fpl_id),
      ...SQUAD.bench.map((p) => p.fpl_id),
    ]),
  ]);
  const preByNorm = loadPreseasonGa();

  console.log("Loading explorer XP / per-90 stats…");
  execSync("npx tsx scripts/load-xhs-squad-stats.ts", {
    cwd: root,
    stdio: "inherit",
  });
  const explorer = loadExplorerStats();
  const statsById = explorer?.by_id ?? {};

  const starters = SQUAD.starters
    .map((s) => enrichSlot(s, bootstrap, fixtures, dbMap, preByNorm))
    .map((p) => mergeExplorerStats(p, statsById));
  const bench = SQUAD.bench
    .map((s) => enrichSlot(s, bootstrap, fixtures, dbMap, preByNorm))
    .map((p) => mergeExplorerStats(p, statsById));
  const spend =
    SQUAD.spend_m ??
    [...starters, ...bench].reduce((sum, p) => sum + p.price, 0);
  const cap = starters.find((p) => p.is_captain)?.web_name ?? "—";
  const vice = starters.find((p) => p.is_vice)?.web_name ?? null;
  const cvLabel = vice ? `${cap} (C) · ${vice} (V)` : `${cap} (C)`;
  const brandLabel = SQUAD.label_en || SQUAD.label_zh || "推荐阵";

  const xiXpGw1 = (() => {
    if (SQUAD.xi_xp != null && Number.isFinite(SQUAD.xi_xp)) return SQUAD.xi_xp;
    let total = 0;
    let ok = 0;
    for (const p of starters) {
      const cell = (p.gw_run || []).find((c) => c.gw === 1);
      if (cell?.xp == null || !Number.isFinite(cell.xp)) continue;
      const mult = p.is_captain ? 2 : 1;
      total += cell.xp * mult;
      ok += 1;
    }
    return ok === 11 ? Math.round(total * 10) / 10 : null;
  })();

  const pitch = {
    date: CARD_DATE,
    eyebrow: "SQUAD PICK · 3-5-2",
    title: "推荐阵容",
    titleHtml: `推荐阵容 · <span class="accent">${brandLabel}</span>`,
    subtitle: `${brandLabel} · ${SQUAD.formation} · £${Number(spend).toFixed(1)}m · ${cvLabel}`,
    starters,
    bench,
    legend:
      "图例 · MID/FWD：季前赛 G / A　·　DEF：季前赛 DC　·　GKP：季前赛 Saves　·　无数据为 - / - 或 -",
    legendHtml:
      '<strong>G / A</strong> 季前赛进球/助攻　·　<strong>DC</strong> 防守贡献　·　<strong>Sv</strong> 扑救　·　无记录显示 - / - 或 -',
    meta: `${CARD_DATE} · faleague-ai.com`,
  };

  const gwLabel =
    explorer?.from_gw && explorer?.to_gw
      ? `GW${explorer.from_gw}–${explorer.to_gw}`
      : "未来 5 轮";

  const why = Array.isArray(SQUAD.why) && SQUAD.why.length
    ? SQUAD.why
    : [
        `${SQUAD.label_zh || "推荐阵"} · ${SQUAD.formation} · £${Number(spend).toFixed(1)}m · 队长 ${cap}。`,
      ];

  const list = {
    date: CARD_DATE,
    eyebrow: "SQUAD LIST · 3-5-2",
    title: "推荐阵容数据一览",
    titleHtml: `推荐阵容 · <span class="accent">${brandLabel}</span>`,
    subtitle: `${brandLabel} · ${SQUAD.formation} · £${Number(spend).toFixed(1)}m · ${cvLabel} · 首发 xP ${xiXpGw1 ?? "—"} · XP 展望 ${gwLabel}`,
    formation: SQUAD.formation,
    starters,
    bench,
    whyLabel: "WHY · 选队理由",
    why,
    source:
      "本阵容由 FALEAGUE 推荐阵容工具生成 · faleague-ai.com",
    sourceHtml:
      '本阵容由 <strong>FALEAGUE 推荐阵容工具</strong>生成 · faleague-ai.com/zh/fpl/insights/recommended-squad',
    note: "列与站内 Players 表一致：XP / 出场 / 威胁 / xG/90 / xA/90 / DC/90 / £/m。不足分钟的速率显示为 —。",
    cta: "打开推荐阵容 →",
    url: "faleague-ai.com/zh/fpl/insights/recommended-squad",
  };

  const attachWhy = (p) => ({
    ...p,
    why: SQUAD.playerWhy?.[p.fpl_id] || `${p.web_name} 入选本套参考阵。`,
  });

  const whyPlayers = {
    starters: starters.map(attachWhy),
    bench: bench.map(attachWhy),
  };
  const analysis = {
    date: CARD_DATE,
    layout: "overview",
    eyebrow: "PLAYER WHY · 3-5-2",
    title: "选人思路",
    titleHtml: `选人思路 · <span class="accent">${brandLabel}</span>`,
    subtitle: `${brandLabel} · ${SQUAD.formation} · £${Number(spend).toFixed(1)}m · ${cvLabel}`,
    starters: whyPlayers.starters,
    bench: whyPlayers.bench,
    cta: "打开推荐阵容 →",
    url: "faleague-ai.com/zh/fpl/insights/recommended-squad",
  };

  const xi = whyPlayers.starters;
  const analysisPages = [
    {
      key: "def",
      date: CARD_DATE,
      layout: "cards",
      page: 1,
      pages: 4,
      eyebrow: "PLAYER WHY · 1/4",
      title: "选人思路",
      titleHtml: '选人思路 · <span class="accent">后防</span>',
      subtitle: `Balanced 3-5-2 · GKP + DEF · GW1–5 FDR / xP · ${SQUAD.formation} · ${cvLabel}`,
      groups: [
        { label: "GKP", players: xi.filter((p) => p.position === "GKP") },
        { label: "DEF", players: xi.filter((p) => p.position === "DEF") },
      ],
      cta: analysis.cta,
      url: analysis.url,
    },
    {
      key: "mid",
      date: CARD_DATE,
      layout: "cards",
      page: 2,
      pages: 4,
      eyebrow: "PLAYER WHY · 2/4",
      title: "选人思路",
      titleHtml: '选人思路 · <span class="accent">中场</span>',
      subtitle: `Balanced 3-5-2 · MID · GW1–5 FDR / xP · ${SQUAD.formation} · ${cvLabel}`,
      groups: [{ label: "MID", players: xi.filter((p) => p.position === "MID") }],
      cta: analysis.cta,
      url: analysis.url,
    },
    {
      key: "fwd",
      date: CARD_DATE,
      layout: "cards",
      page: 3,
      pages: 4,
      eyebrow: "PLAYER WHY · 3/4",
      title: "选人思路",
      titleHtml: '选人思路 · <span class="accent">锋线</span>',
      subtitle: `Balanced 3-5-2 · FWD · GW1–5 FDR / xP · ${SQUAD.formation} · ${cvLabel}`,
      groups: [{ label: "FWD", players: xi.filter((p) => p.position === "FWD") }],
      cta: analysis.cta,
      url: analysis.url,
    },
    {
      key: "bench",
      date: CARD_DATE,
      layout: "cards",
      page: 4,
      pages: 4,
      eyebrow: "PLAYER WHY · 4/4",
      title: "选人思路",
      titleHtml: '选人思路 · <span class="accent">替补</span>',
      subtitle: `Balanced 3-5-2 · BENCH · GW1–5 FDR / xP · ${SQUAD.formation} · ${cvLabel}`,
      groups: [{ label: "BENCH", players: whyPlayers.bench }],
      cta: analysis.cta,
      url: analysis.url,
    },
  ];

  const caption = [
    `3-5-2 均衡阵｜${SQUAD.formation} · £${Number(spend).toFixed(1)}m · 首发 xP ${xiXpGw1 ?? "—"}`,
    "",
    `队长 ${cap}${vice ? `，副队 ${vice}` : ""}`,
    "五中场堆叠 + Isak / João Pedro 双锋，Mbeumo 开队长",
    "左滑看选人思路：后防 → 中场 → 锋线 → 替补",
    "每人附 GW1–5 赛程色块 + 该轮 xP",
    "",
    "XI",
    `GKP ${starters.filter((p) => p.position === "GKP").map((p) => p.web_name).join(" · ")}`,
    `DEF ${starters.filter((p) => p.position === "DEF").map((p) => p.web_name).join(" · ")}`,
    `MID ${starters
      .filter((p) => p.position === "MID")
      .map((p) => p.web_name)
      .join(" · ")}`,
    `FWD ${starters
      .filter((p) => p.position === "FWD")
      .map((p) => `${p.web_name}${p.is_captain ? " (C)" : p.is_vice ? " (V)" : ""}`)
      .join(" · ")}`,
    `BENCH ${bench.map((p) => p.web_name).join(" · ")}`,
    "",
    "这套怎么排的",
    ...why.map((line) => `✅ ${line}`),
    "",
    "参考阵，不是唯一解。构建器里可继续微调。",
    "👉 https://faleague-ai.com/zh/squad-builder",
    "",
    "#FPL #FantasyPremierLeague #英超 #范特西足球 #开局阵容 #推荐阵容 #FALEAGUE #GW1 #352 #选人思路",
  ].join("\n");

  writeFileSync(
    join(outDir, `squad-${CARD_DATE}.json`),
    JSON.stringify({ pitch, list, analysis, analysisPages, caption }, null, 2),
    "utf8",
  );
  writeFileSync(join(outDir, `squad-${CARD_DATE}-caption.txt`), caption, "utf8");

  const whyHtml = join(__dirname, "wechat", "xhs-squad-why.html");
  const browser = await chromium.launch();
  try {
    await renderPoster(
      browser,
      join(__dirname, "wechat", "xhs-squad-pitch.html"),
      pitch,
      join(outDir, `squad-pitch-${CARD_DATE}.png`),
    );
    await renderPoster(
      browser,
      join(__dirname, "wechat", "xhs-squad-list.html"),
      list,
      join(outDir, `squad-list-${CARD_DATE}.png`),
    );
    await renderPoster(
      browser,
      whyHtml,
      analysis,
      join(outDir, `squad-why-${CARD_DATE}.png`),
    );
    for (const page of analysisPages) {
      await renderPoster(
        browser,
        whyHtml,
        page,
        join(outDir, `squad-why-${CARD_DATE}-${page.key}.png`),
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
