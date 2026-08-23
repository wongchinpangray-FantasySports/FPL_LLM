#!/usr/bin/env node
/**
 * Render Xiaohongshu (小红书) 3:4 posters for Daily + BoP.
 *
 *   cd web && node scripts/render-xhs-posters.mjs
 *   cd web && node scripts/render-xhs-posters.mjs --variant=heads,visual
 *
 * Output (per date):
 *   output/xhs/daily-{date}.png          editorial (default keep)
 *   output/xhs/bop-{date}.png
 *   output/xhs/daily-{date}-heads.png    player headshots
 *   output/xhs/bop-{date}-heads.png
 *   output/xhs/daily-{date}-visual.png   pitch / glow visual
 *   output/xhs/bop-{date}-visual.png
 */
import { mkdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const wechatDir = join(__dirname, "wechat");
const outDir = join(root, "output", "xhs");
const WIDTH = 1080;
const HEIGHT = 1440;

const TEMPLATES = {
  editorial: join(wechatDir, "xhs-poster.html"),
  heads: join(wechatDir, "xhs-poster-heads.html"),
  visual: join(wechatDir, "xhs-poster-visual.html"),
};

const CLUB_COLORS = {
  MUN: "#DA291C",
  LIV: "#C8102E",
  BRE: "#E30613",
  NFO: "#DD0000",
  CRY: "#0A4AF5",
  FUL: "#FFFFFF",
  SUN: "#E52229",
};

function loadJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function photoUrl(code) {
  if (!code) return null;
  return `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png`;
}

function shirtUrl(teamCode) {
  if (!teamCode) return null;
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.webp`;
}

function badgeUrl(teamCode) {
  if (!teamCode) return null;
  return `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`;
}

async function photoOrShirt(code, teamCode) {
  const photo = photoUrl(code);
  if (photo) {
    try {
      const r = await fetch(photo, { method: "HEAD" });
      if (r.ok) return { photo, kind: "photo" };
    } catch {
      // fall through
    }
  }
  return { photo: shirtUrl(teamCode), kind: "shirt" };
}

async function loadFplCatalog(neededIds = []) {
  const res = await fetch("https://fantasy.premierleague.com/api/bootstrap-static/");
  if (!res.ok) throw new Error(`FPL bootstrap failed: ${res.status}`);
  const data = await res.json();
  const byId = new Map();
  const byName = new Map();
  const teamsById = new Map();
  const teamsByShort = new Map();

  for (const t of data.teams || []) {
    teamsById.set(t.id, t);
    teamsByShort.set(String(t.short_name).toUpperCase(), t);
  }

  for (const e of data.elements || []) {
    const team = teamsById.get(e.team);
    const entry = {
      id: e.id,
      web_name: e.web_name,
      code: e.code,
      photo: photoUrl(e.code),
      shirt: shirtUrl(team?.code),
      team_short: team?.short_name ?? null,
      team_code: team?.code ?? null,
      badge: badgeUrl(team?.code),
    };
    byId.set(e.id, entry);
    byName.set(String(e.web_name).toLowerCase(), entry);
  }

  // Resolve headshots for players we will render (403 → club shirt fallback).
  const resolveIds = [...new Set(neededIds.filter(Boolean))];
  await Promise.all(
    resolveIds.map(async (id) => {
      const entry = byId.get(id);
      if (!entry) return;
      const resolved = await photoOrShirt(entry.code, entry.team_code);
      entry.photo = resolved.photo;
      entry.photo_kind = resolved.kind;
    }),
  );

  return { byId, byName, teamsByShort };
}

function findPlayer(catalog, { fplId, name }) {
  if (fplId != null && catalog.byId.has(fplId)) return catalog.byId.get(fplId);
  if (!name) return null;
  const key = String(name).toLowerCase();
  if (catalog.byName.has(key)) return catalog.byName.get(key);
  for (const [n, p] of catalog.byName) {
    if (n.includes(key) || key.includes(n)) return p;
  }
  return null;
}

function clubBadge(catalog, short) {
  const t = catalog.teamsByShort.get(String(short || "").toUpperCase());
  return t ? badgeUrl(t.code) : null;
}

function shorten(text, max = 72) {
  const t = String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/🚨+/g, "")
    .replace(/💣/g, "")
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function parseScoreLine(line) {
  const m = String(line).match(/^(.+?)\s+(\d+)-(\d+)\s+(.+)$/);
  if (!m) return null;
  const home = m[1].trim();
  const away = m[4].trim();
  const shortHome = home
    .replace(/^Manchester /, "Man ")
    .replace(/^Nott'm /, "NFO ")
    .replace(/^Tottenham Hotspur$|^Spurs$/i, "Spurs");
  const shortAway = away
    .replace(/^Borussia Dortmund$/i, "Dortmund")
    .replace(/^Johor Darul Ta'?zim$/i, "JDT")
    .replace(/^Paris Saint-Germain$/i, "PSG")
    .replace(/^Atletico Madrid$/i, "Atletico")
    .replace(/^Real Betis$/i, "Betis")
    .replace(/^Eintracht Frankfurt$/i, "Frankfurt")
    .replace(/^Rayo Vallecano$/i, "Rayo")
    .replace(/^RB Leipzig$/i, "Leipzig");
  return {
    teams: `${shortHome} vs ${shortAway}`,
    home: shortHome,
    away: shortAway,
    digits: `${m[2]}-${m[3]}`,
  };
}

function shortClub(name) {
  return String(name || "")
    .replace(/^Manchester United$/i, "Man Utd")
    .replace(/^Manchester City$/i, "Man City")
    .replace(/^Leeds United$/i, "Leeds")
    .replace(/^Nott'?m Forest$/i, "Forest")
    .replace(/^Aston Villa$/i, "Villa")
    .replace(/^Coventry City$/i, "Coventry")
    .replace(/^Paris Saint-Germain$/i, "PSG")
    .replace(/^Bayer Leverkusen$/i, "Leverkusen")
    .replace(/^Borussia Monchengladbach$/i, "Gladbach")
    .trim();
}

function parseUpcomingFixtureGroups(lines) {
  const groups = [];
  let cur = null;
  for (const raw of lines || []) {
    const line = String(raw || "").trim();
    const header = line.match(/^▸\s*(.+?)（.+?）·\s*(\d+)\s*场/);
    if (header) {
      const dateLabel = header[1];
      const dateShort = dateLabel.replace(/(\d+)月(\d+)日/, (_, m, d) =>
        `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`,
      );
      cur = {
        dateLabel,
        dateShort,
        count: Number(header[2]) || 0,
        fixtures: [],
      };
      groups.push(cur);
      continue;
    }
    const fx =
      line.match(/^(.+?)\s+vs\s+(.+?)(?:｜(.+))?$/) ||
      line.match(/^(.+?)\s+vs\s+(.+)$/);
    if (fx && cur) {
      cur.fixtures.push({
        home: fx[1].trim(),
        away: fx[2].trim(),
        meta: "",
      });
    }
  }
  return groups;
}

/** Compact poster headlines from digest transfer bullets (card order). */
function shortTransferHeadline(line) {
  const t = String(line || "");
  if (/Araujo|阿劳霍/i.test(t)) return "Araujo→利物浦（租借）";
  if (/Barcola|巴尔科拉/i.test(t)) return "Barcola→利物浦仍在谈";
  if (/Chalobah|查洛巴/i.test(t) && /Como|科莫/i.test(t)) return "查洛巴→Como（官宣）";
  if (/Chalobah|查洛巴/i.test(t)) return "查洛巴→Como（官宣）";
  if (/Charles|查尔斯/i.test(t)) return "查尔斯→富勒姆（£30m）";
  if (/\bPage\b|少年 Page/i.test(t)) return "曼联盯莱斯特少年 Page";
  if (/Khalaili/i.test(t)) return "Palace 敲定 Khalaili";
  if (/Tchouameni/i.test(t)) return "Tchouameni 续约皇马";
  if (/Guessand/i.test(t)) return "Palace 洽谈租回 Guessand";
  if (/Solomon|所罗门/i.test(t)) return "所罗门→西汉姆进展";
  if (/Senesi|Bissouma|Savinho|Van Hecke/i.test(t)) {
    return "热刺：Senesi/Bissouma 等动态";
  }
  if (/LaLiga|release clause|解约/i.test(t)) return "曼联盯西甲解约目标";
  return shorten(t.replace(/\s*[-–—].*$/, ""), 28);
}

function summarizeTransfersForPoster(lines) {
  const headlines = [];
  const seen = new Set();
  for (const line of lines || []) {
    const h = shortTransferHeadline(line);
    if (!h || seen.has(h)) continue;
    seen.add(h);
    headlines.push(h);
  }
  if (!headlines.length) {
    return {
      lead: "今日转会焦点",
      detail: undefined,
      headlines: [],
      ticker: "TRANSFERS",
      faceName: null,
    };
  }
  const ticker = /Araujo/i.test(headlines[0])
    ? "ARAUJO IN"
    : /Barcola/i.test(headlines[0])
      ? "BARCOLA"
      : /查洛巴|Chalobah|Como/i.test(headlines[0])
        ? "CHALOBAH OUT"
        : /查尔斯|Charles/i.test(headlines[0])
          ? "CHARLES IN"
          : /Khalaili|Palace/i.test(headlines[0])
            ? "KHALAILI"
            : "TRANSFERS";
  const faceName = /Araujo/i.test(headlines[0])
    ? "Araujo"
    : /Barcola/i.test(headlines[0])
      ? "Barcola"
      : /查洛巴|Chalobah/i.test(headlines[0])
        ? "Chalobah"
        : /查尔斯|Charles/i.test(headlines[0])
          ? "Charles"
          : null;
  return {
    lead: headlines[0],
    detail: headlines.slice(1, 4).join(" · ") || undefined,
    headlines,
    ticker,
    faceName,
  };
}

function lastNumber(text) {
  const matches = [...String(text).matchAll(/(\d+(?:\.\d+)?)/g)];
  return matches.length ? matches[matches.length - 1][1] : "—";
}

function firstNumber(text) {
  const m = String(text).match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : "—";
}

function metricFromTakeaway(t) {
  const kind = t.kind || "";
  const blurb = t.blurb_zh || t.blurb_en || "";
  // Prefer the stat next to the metric label — blurbs often end with a minutes
  // threshold (e.g. "xP 26.8 … ≥1200 分钟") which lastNumber wrongly picks.
  if (kind === "xp" || /xP/i.test(blurb)) {
    const m =
      blurb.match(/xP\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      blurb.match(/([0-9]+(?:\.[0-9]+)?)\s*xP/i);
    return { value: m?.[1] ?? firstNumber(blurb), label: "xP" };
  }
  if (kind === "defcon" || /DEFCON/i.test(blurb)) {
    const m =
      blurb.match(/DEFCON(?:\/90)?\s*[（(]?([0-9]+(?:\.[0-9]+)?)/i) ||
      blurb.match(/[（(]([0-9]+(?:\.[0-9]+)?)[)）]/);
    return { value: m?.[1] ?? lastNumber(blurb), label: "DEFCON" };
  }
  if (kind === "attack" || /威胁|threat/i.test(blurb)) {
    const m =
      blurb.match(/威胁(?:指数)?\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      blurb.match(/threat(?:\s*index)?\s*([0-9]+(?:\.[0-9]+)?)/i) ||
      blurb.match(/[（(]([0-9]+(?:\.[0-9]+)?)[)）]/);
    return { value: m?.[1] ?? lastNumber(blurb), label: "THREAT" };
  }
  return { value: lastNumber(blurb), label: "STAT" };
}

function buildDailyPoster(card, catalog) {
  const date = card?.card_date ?? "2026-08-09";
  const sections = card?.sections ?? [];
  const injury =
    sections.find((s) => /伤病|球队新闻|Injuries/i.test(s.title))?.lines ?? [];
  const transfers =
    sections.find((s) => /转会|流言|Transfers/i.test(s.title))?.lines ?? [];
  const preseasonSec = sections.find((s) =>
    /季前|preseason|昨日|近两日/i.test(s.title),
  );
  const upcomingSec = sections.find((s) => /即将到来的友谊赛/i.test(s.title));
  const preseason = preseasonSec?.lines ?? [];
  const upcoming = upcomingSec?.lines ?? [];
  const isUpcomingMode = !preseason.length && upcoming.length > 0;

  const cleanLine = (l) =>
    String(l || "")
      .replace(/^Best\s+(?:Goalkeepers|Defenders|Midfielders|Forwards)\s*:\s*/i, "")
      .replace(/\s*@.*$/, "")
      .trim();

  // Skip recycled / non-injury blurbs for the injury slot.
  const staleInjuryRe =
    /Mount|芒特|Rashford|拉什福德|未来动向|未来待定|future (at|remains)/i;
  const injuryLikeRe =
    /伤|伤停|伤缺|复出|康复|出战|伤愈|doubt|injur|fitness|available|可用|缺阵|轮休/i;
  const freshInjury = injury
    .map(cleanLine)
    .filter(Boolean)
    .filter((l) => !staleInjuryRe.test(l) && injuryLikeRe.test(l));
  const hasFreshInjury = freshInjury.length > 0;
  const injuryLead = hasFreshInjury
    ? shorten(freshInjury[0], 30)
    : "暂无新伤病更新";
  const injuryDetail = hasFreshInjury
    ? freshInjury[1]
      ? shorten(freshInjury[1], 40)
      : undefined
    : "今日简报未收录新伤情";

  const transferRaw = transfers.map(cleanLine).filter(Boolean);
  const transferSummary = summarizeTransfersForPoster(transferRaw);
  const transferLead = transferSummary.lead;
  const transferDetail = transferSummary.detail;
  const hasChalobah = transferRaw.some((l) => /Chalobah|查洛巴/i.test(l));
  const hasAraujo = transferRaw.some((l) => /Araujo|阿劳霍/i.test(l));

  const allScores = preseason.map(parseScoreLine).filter(Boolean);
  // Prefer big PL clubs first, then fill remaining slots.
  const priority = [
    /Arsenal/i,
    /Liverpool/i,
    /Man City/i,
    /Chelsea/i,
    /Man Utd/i,
    /Spurs|Tottenham/i,
    /Newcastle/i,
    /Brighton/i,
    /Brentford/i,
    /Nott'?m Forest/i,
  ];
  const ranked = [...allScores].sort((a, b) => {
    const rank = (s) => {
      const i = priority.findIndex((re) => re.test(s.home) || re.test(s.teams));
      return i < 0 ? 99 : i;
    };
    return rank(a) - rank(b);
  });
  const featuredScores = ranked.slice(0, 4);
  const moreScores = ranked.slice(4);
  const scores = ranked;

  const scorers = preseason
    .filter((l) => /球|助/.test(l) && !/\d-\d/.test(l))
    .slice(0, 2)
    .map((l) => String(l).split(/（|\(/)[0].trim())
    .filter(Boolean);

  const upcomingGroups = parseUpcomingFixtureGroups(upcoming);
  const upcomingRows = upcomingGroups.flatMap((g) =>
    g.fixtures.map((f) => ({
      date: g.dateShort,
      teams: `${shortClub(f.home)} vs ${shortClub(f.away)}`,
      home: shortClub(f.home),
      away: shortClub(f.away),
      meta: f.meta,
      digits: g.dateShort,
    })),
  );
  const featuredFixtures = upcomingRows.slice(0, 4);
  const moreFixtures = upcomingRows.slice(4, 8);
  const upcomingTicker = upcomingGroups
    .slice(0, 3)
    .map((g) => `${g.dateShort} · ${g.count}场`);

  const mount = findPlayer(catalog, { name: "Mount" });
  const jacquet = findPlayer(catalog, { name: "Jacquet" });
  const araujo = findPlayer(catalog, { name: "Araujo" });
  const chalobah = findPlayer(catalog, { name: "Chalobah" });
  const transferFacePlayer =
    (transferSummary.faceName &&
      findPlayer(catalog, { name: transferSummary.faceName })) ||
    araujo ||
    chalobah ||
    findPlayer(catalog, { name: "Rashford" });
  const joao =
    findPlayer(catalog, { name: "João Pedro" }) ||
    findPlayer(catalog, { name: "Joao Pedro" });
  const delap = findPlayer(catalog, { name: "Delap" });
  const goalsFacePlayer = joao || delap;

  const injuryClub =
    hasFreshInjury && /雅凯|Jacquet|Liverpool|利物浦/i.test(freshInjury[0] || "")
      ? "LIV"
      : hasFreshInjury && /桑托斯|Santos|Casemiro|曼联|Man Utd/i.test(freshInjury[0] || "")
        ? "MUN"
        : null;

  const injuryFace = {
    name: hasFreshInjury ? "NEWS" : "—",
    photo: jacquet?.photo || null,
    photo_kind: jacquet?.photo_kind || "photo",
    tag: "伤病",
  };
  const transferFace = {
    name: transferFacePlayer?.web_name || transferSummary.faceName || "NEWS",
    photo: transferFacePlayer?.photo ?? null,
    photo_kind: transferFacePlayer?.photo_kind || "photo",
    tag: "转会",
  };
  const goalsFace = {
    name: isUpcomingMode ? "FIXTURES" : goalsFacePlayer?.web_name || "PL",
    photo: isUpcomingMode
      ? clubBadge(catalog, "ARS")
      : goalsFacePlayer?.photo || clubBadge(catalog, "CHE"),
    photo_kind: isUpcomingMode ? "shirt" : goalsFacePlayer?.photo_kind || "shirt",
    tag: isUpcomingMode ? "赛程" : "进球",
  };

  const fixtureCount = upcomingGroups.reduce((n, g) => n + g.fixtures.length, 0);
  const matchCount = Number(
    String(preseasonSec?.title || upcomingSec?.title || "").match(/(\d+)\s*场/)?.[1] ||
      (isUpcomingMode ? fixtureCount || upcoming.length : allScores.length),
  );

  const title = isUpcomingMode
    ? hasAraujo
      ? "阿劳霍加盟，明日友谊赛抢先看"
      : "明日友谊赛赛程抢先看"
    : hasAraujo
      ? "阿劳霍加盟利物浦，转会窗升温"
      : hasChalobah
        ? "查洛巴离队，周末友谊赛齐开打"
        : matchCount
          ? "周末友谊赛大开杀戒"
          : "今日 FPL 必看";
  const titleHtml = isUpcomingMode
    ? hasAraujo
      ? '<span class="accent">阿劳霍</span>加盟，明日友谊赛抢先看'
      : '明日友谊赛<span class="accent">赛程抢先看</span>'
    : hasAraujo
      ? '<span class="accent">阿劳霍</span>加盟利物浦，转会窗升温'
      : hasChalobah
        ? '<span class="accent">查洛巴</span>离队，周末友谊赛齐开打'
        : matchCount
          ? '周末友谊赛<span class="accent">大开杀戒</span>'
          : escLite(title);

  return {
    kind: "daily",
    date,
    eyebrow: "FPL DAILY BRIEF",
    ribbon: "DAILY",
    title,
    titleHtml,
    subtitle: isUpcomingMode
      ? `${transferLead} · 即将 ${matchCount} 场友谊赛`
      : `${hasFreshInjury ? "伤病更新" : "伤病暂无新讯"} · ${transferLead} · 季前赛${matchCount ? `${matchCount}场` : ""}`,
    faces: [injuryFace, transferFace, goalsFace],
    stories: [
      {
        label: "伤病",
        lead: injuryLead,
        detail: injuryDetail,
        face: injuryFace,
        color: hasFreshInjury ? CLUB_COLORS.LIV : "#52525b",
        badge:
          clubBadge(catalog, injuryClub || "LIV") ||
          jacquet?.badge ||
          mount?.badge,
        muted: !hasFreshInjury,
      },
      {
        label: "转会",
        hot: true,
        lead: transferLead,
        detail: transferDetail,
        bullets: transferSummary.headlines.slice(0, 5),
        face: transferFace,
        color: CLUB_COLORS.LIV,
        badge:
          clubBadge(catalog, hasAraujo ? "LIV" : "CHE") ||
          clubBadge(catalog, "LIV"),
      },
      isUpcomingMode
        ? {
            label: "赛程",
            lead:
              upcomingGroups[0]
                ? `${upcomingGroups[0].dateLabel}开打 · ${matchCount} 场`
                : `接下来 ${matchCount} 场友谊赛`,
            detail: upcomingGroups
              .slice(0, 3)
              .map((g) => `${g.dateLabel} ${g.count}场`)
              .join(" · "),
            scores: featuredFixtures,
            moreScores: moreFixtures,
            fixtureGroups: upcomingGroups,
            face: goalsFace,
            color: CLUB_COLORS.BRE,
            badge: clubBadge(catalog, "ARS") || clubBadge(catalog, "MUN"),
          }
        : {
            label: "季前赛",
            lead: scorers.length
              ? `${scorers.join(" · ")} 贡献进球`
              : matchCount
                ? `近两日 ${matchCount} 场友谊赛`
                : "昨日友谊赛结果",
            detail: scores.length ? undefined : "暂无已收录赛果",
            scores: featuredScores,
            moreScores,
            face: goalsFace,
            color: CLUB_COLORS.BRE,
            badge: clubBadge(catalog, "CHE") || goalsFacePlayer?.badge,
          },
    ],
    ticker: [
      "FALEAGUE DAILY",
      hasFreshInjury ? "INJURY UPDATE" : "NO INJURY UPDATE",
      transferSummary.ticker,
      ...(isUpcomingMode
        ? upcomingTicker
        : scores.slice(0, 4).map((s) => s.digits)),
      "faleague-ai.com",
    ],
    cta: "打开完整简报 →",
    url: "faleague-ai.com/zh/news/fpl-daily",
  };
}

function escLite(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildBopPoster(hook, catalog) {
  const date = hook?.card_date ?? "2026-08-09";
  const price = hook?.price ?? "4.5";
  const pos = hook?.position_zh ?? "中场";
  const top = hook?.top_player ?? "—";
  const xp = hook?.top_xp != null ? Number(hook.top_xp).toFixed(1) : null;
  const assessed = hook?.assessed ?? 21;

  const mapPlayer = (p) => {
    const entry = findPlayer(catalog, { fplId: p.fpl_id, name: p.web_name });
    // Prefer club shirts — headshots are often stale after transfers.
    const shirt = entry?.shirt || shirtUrl(entry?.team_code);
    return {
      name: p.web_name || "—",
      team: p.team || entry?.team_short || "",
      value:
        typeof p.value === "number"
          ? Number.isInteger(p.value)
            ? String(p.value)
            : p.value.toFixed(1)
          : String(p.value ?? "—"),
      photo: shirt || entry?.photo || null,
      photo_kind: shirt ? "shirt" : entry?.photo_kind || "photo",
      badge: entry?.badge ?? null,
    };
  };

  const categoryTops = (hook?.category_tops ?? []).map((cat) => ({
    kind: cat.kind,
    label: cat.label,
    label_zh: cat.label_zh,
    players: (cat.players ?? []).slice(0, 3).map(mapPlayer),
  }));

  const xpSpotlight = categoryTops.find((c) => c.kind === "xp")?.players?.[0];
  const spotlightName = xpSpotlight?.name || top;
  const spotlightXp = xpSpotlight?.value || (xp != null ? xp : null);
  const minutesFloor = hook?.minutes_floor ?? 1200;

  // Prefer one leader per category (xP / DEFCON / THREAT) so the podium
  // stays complete even when takeaways omit a duplicate player.
  const ranksFromCats = categoryTops
    .filter((c) => c.players?.[0])
    .slice(0, 3)
    .map((c) => ({
      ...c.players[0],
      label: c.label || "STAT",
    }));
  const takeaways = (hook?.takeaways ?? []).slice(0, 3);
  const ranksFromTakeaways = takeaways.map((t) => {
    const metric = metricFromTakeaway(t);
    const mapped = mapPlayer({
      fpl_id: t.fpl_id,
      web_name: t.web_name,
      team: t.team,
      value: Number(metric.value),
    });
    return { ...mapped, label: metric.label };
  });
  // Prefer takeaways for the podium so xP / DEFCON / THREAT stay distinct
  // players (category_tops can repeat the same name across metrics).
  const ranks = (ranksFromTakeaways.length ? ranksFromTakeaways : ranksFromCats).slice(
    0,
    3,
  );
  while (ranks.length < 3) {
    ranks.push({ name: "—", team: "", value: "—", label: "—", photo: null });
  }

  const bandUrl =
    hook?.band_url?.replace(/^https?:\/\//, "") ??
    "faleague-ai.com/zh/fpl/insights/best-of-position";

  return {
    kind: "bop",
    date,
    eyebrow: "BEST OF POSITION",
    ribbon: "BOP",
    price,
    priceMark: price,
    position: pos,
    title: "钱花在谁身上？",
    subtitle: `评估 ${assessed} 人 · 未来 5 轮 · ${spotlightName} 领跑 xP${spotlightXp ? ` ${spotlightXp}` : ""}`,
    disclaimer: `出场门槛：上季 ≥${minutesFloor} 分钟优先（不足时补位填满榜单）`,
    ranks,
    categories: categoryTops,
    chips: (hook?.siblings ?? []).slice(0, 3).map((s) => s.label).filter(Boolean),
    cta: "打开完整排名 →",
    url: bandUrl,
    urlShort: "faleague-ai.com/bop",
  };
}

async function renderPoster(browser, htmlPath, poster, outPath) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
  await page.addInitScript((data) => {
    window.__POSTER__ = data;
  }, poster);
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  try {
    await page.waitForFunction(
      () =>
        [...document.images].every((img) => img.complete && img.naturalWidth > 0) ||
        [...document.images].every((img) => img.complete),
      { timeout: 8000 },
    );
  } catch {
    // Some remote photos / badges may 404 — continue with fallbacks.
  }
  await page.waitForTimeout(200);
  await page.screenshot({
    path: outPath,
    type: "png",
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  });
  await page.close();
  console.log(`Wrote ${outPath}`);
}

function parseVariants(argv) {
  const raw = argv.find((a) => a.startsWith("--variant="));
  if (!raw) return ["editorial", "heads", "visual"];
  return raw
    .slice("--variant=".length)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => TEMPLATES[s]);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const variants = parseVariants(process.argv.slice(2));

  const card = loadJson(join(root, "output", "wechat-daily", "card.json"));
  const hook = loadJson(join(root, "output", "wechat-bop", "hook.json"));
  const bopIds = [
    ...(hook?.takeaways ?? []).map((t) => t.fpl_id),
    ...(hook?.category_tops ?? []).flatMap((c) =>
      (c.players ?? []).map((p) => p.fpl_id),
    ),
  ].filter(Boolean);
  // Mount, Rashford, João Pedro — Daily faces; BoP takeaways by id
  const neededIds = [430, 429, ...bopIds];

  console.log("Fetching FPL bootstrap for player photos…");
  const catalog = await loadFplCatalog(neededIds);

  const daily = buildDailyPoster(card ?? {}, catalog);
  const bop = buildBopPoster(hook ?? {}, catalog);

  writeFileSync(join(outDir, `daily-${daily.date}.json`), JSON.stringify(daily, null, 2), "utf8");
  writeFileSync(join(outDir, `bop-${bop.date}.json`), JSON.stringify(bop, null, 2), "utf8");

  const jobs = [];
  for (const variant of variants) {
    const suffix = variant === "editorial" ? "" : `-${variant}`;
    jobs.push({
      variant,
      html: TEMPLATES[variant],
      poster: daily,
      out: join(outDir, `daily-${daily.date}${suffix}.png`),
    });
    jobs.push({
      variant,
      html: TEMPLATES[variant],
      poster: bop,
      out: join(outDir, `bop-${bop.date}${suffix}.png`),
    });
  }

  const browser = await chromium.launch();
  try {
    for (const job of jobs) {
      await renderPoster(browser, job.html, job.poster, job.out);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
