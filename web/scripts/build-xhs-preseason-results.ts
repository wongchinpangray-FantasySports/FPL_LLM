/**
 * Build XHS poster JSON: all PL club preseason digests, 2 clubs per page.
 *
 *   npx tsx scripts/build-xhs-preseason-results.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPreseasonClubSummaries,
  formatPreseasonDate,
  formatPreseasonScore,
  getPreseasonBundle,
  groupPreseasonByClub,
  preseasonOpponentLabel,
  type PreseasonClubSummary,
  type PreseasonMatch,
} from "../lib/fpl/preseason";
import { getFplTeamTheme } from "../lib/team-themes";

type PosterMatch = {
  date: string;
  date_label: string;
  home: boolean;
  ha: string;
  opponent: string;
  score: string;
  note: string | null;
};

type PosterClub = {
  pl_code: string;
  pl_name: string;
  short: string;
  sort_name: string;
  badge: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  record: string;
  form: Array<"W" | "D" | "L">;
  matches: PosterMatch[];
  top_scorers: Array<{ name: string; short: string; count: number }>;
  top_assists: Array<{ name: string; short: string; count: number }>;
  scorers_line: string;
  assists_line: string;
  color: {
    primary: string;
    secondary: string;
    accent: string;
    /** Vivid ink for numbers on dark cards. */
    ink: string;
    /** Tint used for card chrome (avoid near-white primaries washing the panel). */
    tint: string;
  };
};

function hexLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  if (raw.length !== 6) return 0;
  const channels = [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clubInk(primary: string, secondary: string, code: string): string {
  // Light kits / dark secondary ink are unreadable on dark poster cards.
  if (code === "FUL" || code === "TOT" || code === "LEE") return "#FFFFFF";
  if (hexLuminance(primary) > 0.72) return "#FFFFFF";
  if (hexLuminance(primary) < 0.08) {
    return hexLuminance(secondary) > 0.45 ? secondary : "#00ff87";
  }
  return primary;
}

function clubTint(primary: string, secondary: string, code: string): string {
  // White / near-white kits wash out the card — tint with secondary instead.
  if (code === "FUL") return "#9CA3AF";
  if (code === "TOT") return "#3B4F8A";
  if (code === "LEE") return "#1D428A";
  if (hexLuminance(primary) > 0.72) {
    return hexLuminance(secondary) > 0.2 ? secondary : "#9CA3AF";
  }
  return primary;
}

function shortClub(name: string): string {
  return name
    .replace(/^Manchester United$/i, "Man Utd")
    .replace(/^Manchester City$/i, "Man City")
    .replace(/^Nottingham Forest$|^Nott'?m Forest$/i, "Forest")
    .replace(/^Tottenham Hotspur$|^Spurs$/i, "Spurs")
    .replace(/^Wolverhampton Wanderers$|^Wolves$/i, "Wolves")
    .replace(/^Brighton & Hove Albion$|^Brighton$/i, "Brighton")
    .replace(/^West Ham United$|^West Ham$/i, "West Ham")
    .replace(/^Newcastle United$|^Newcastle$/i, "Newcastle")
    .replace(/^Aston Villa$/i, "Villa")
    .replace(/^Leeds United$/i, "Leeds")
    .replace(/^Ipswich Town$/i, "Ipswich")
    .replace(/^Crystal Palace$/i, "Palace")
    .replace(/^Coventry City$/i, "Coventry")
    .replace(/^Hull City$/i, "Hull")
    .replace(/^Bournemouth$/i, "Bournemouth")
    .replace(/^Sunderland$/i, "Sunderland")
    .trim();
}

function shortPlayer(name: string): string {
  const cleaned = name
    .replace(/^Jo[aã]o Pedro$/i, "J.Pedro")
    .replace(/^Enzo Le F[eé]e$|^Enzo Le Fee$/i, "Le Fée")
    .trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length <= 1) return cleaned;
  const last = parts[parts.length - 1]!;
  if (last.includes("-") || last.length >= 5) return last;
  if (parts.length >= 2 && parts[parts.length - 2]!.length <= 3) {
    return `${parts[parts.length - 2]} ${last}`;
  }
  return last;
}

function formatStatLine(
  rows: Array<{ name: string; count: number }>,
  max = 4,
): string {
  if (!rows.length) return "—";
  return rows
    .slice(0, max)
    .map((r) =>
      r.count > 1 ? `${shortPlayer(r.name)}×${r.count}` : shortPlayer(r.name),
    )
    .join(" · ");
}

function toPosterMatch(m: PreseasonMatch): PosterMatch {
  const score =
    m.status === "finished" ? formatPreseasonScore(m) ?? "—" : "待赛";
  return {
    date: m.date,
    date_label: formatPreseasonDate(m.date, "zh-CN"),
    home: m.pl_home,
    ha: m.pl_home ? "主" : "客",
    opponent: preseasonOpponentLabel(m),
    score,
    note: m.note,
  };
}

function toPosterClub(s: PreseasonClubSummary): PosterClub {
  const theme = getFplTeamTheme(s.code);
  const sortName =
    s.code === "TOT"
      ? "Tottenham Hotspur"
      : s.code === "NFO"
        ? "Nottingham Forest"
        : s.code === "MCI"
          ? "Manchester City"
          : s.code === "MUN"
            ? "Manchester United"
            : theme.label;
  return {
    pl_code: s.code,
    pl_name: s.name,
    short: shortClub(s.name),
    sort_name: sortName,
    badge: null,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    gf: s.gf,
    ga: s.ga,
    record: `${s.won}胜-${s.drawn}平-${s.lost}负`,
    form: s.form,
    matches: s.matches.map(toPosterMatch),
    top_scorers: s.topScorers.slice(0, 6).map((r) => ({
      name: r.name,
      short: shortPlayer(r.name),
      count: r.count,
    })),
    top_assists: s.topAssists.slice(0, 6).map((r) => ({
      name: r.name,
      short: shortPlayer(r.name),
      count: r.count,
    })),
    scorers_line: formatStatLine(s.topScorers, 4),
    assists_line: formatStatLine(s.topAssists, 3),
    color: {
      primary: theme.primary,
      secondary: theme.secondary,
      accent: theme.accent,
      ink: clubInk(theme.primary, theme.secondary, s.code),
      tint: clubTint(theme.primary, theme.secondary, s.code),
    },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function main() {
  const bundle = getPreseasonBundle();
  const groups = groupPreseasonByClub(bundle.matches);
  const clubs = buildPreseasonClubSummaries(groups)
    .map(toPosterClub)
    .sort((a, b) => a.sort_name.localeCompare(b.sort_name, "en"));
  const pairs = chunk(clubs, 2);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const pages = pairs.map((pair, i) => ({
    page: i + 1,
    total_pages: pairs.length,
    clubs: pair,
  }));

  const out = {
    kind: "preseason-results",
    date,
    season: bundle.season,
    title: "英超季前赛状态雷达",
    subtitle: "各队射手 / 助攻优先 · 赛果作参考 · FPL 选人先看状态",
    total_clubs: clubs.length,
    clubs,
    pages,
  };

  const outDir = join(process.cwd(), "output", "xhs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `preseason-results-${date}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

  const hotScorers = [...clubs]
    .filter((c) => c.top_scorers[0])
    .sort(
      (a, b) =>
        (b.top_scorers[0]?.count ?? 0) - (a.top_scorers[0]?.count ?? 0) ||
        a.short.localeCompare(b.short),
    )
    .slice(0, 3)
    .map((c) => {
      const s = c.top_scorers[0]!;
      return `${c.short} ${s.short} ${s.count}球`;
    });
  const hotAssists = [...clubs]
    .filter((c) => c.top_assists[0])
    .sort(
      (a, b) =>
        (b.top_assists[0]?.count ?? 0) - (a.top_assists[0]?.count ?? 0) ||
        a.short.localeCompare(b.short),
    )
    .slice(0, 2)
    .map((c) => {
      const a = c.top_assists[0]!;
      return `${c.short} ${a.short} ${a.count}助`;
    });

  const caption = [
    `季前赛结束了，别只看比分👀`,
    `FPL 开局更该看：谁在进球、谁在送点`,
    "",
    `【英超季前赛状态雷达｜${bundle.season}】`,
    `20 队射手榜 + 助攻榜 · A–Z 滑动看完`,
    "",
    hotScorers.length
      ? `🔥 射手热点：${hotScorers.join(" · ")}`
      : "🔥 各队头号射手已整理进图",
    hotAssists.length
      ? `🎯 助攻热点：${hotAssists.join(" · ")}`
      : "🎯 助攻数据按俱乐部拆开看",
    "",
    "每队一张卡：Hot Scorer → 射手/助攻榜 → 赛果作参考",
    "选队长、挖差分、盯新援，先看谁真正有状态。",
    "",
    "你开局最想跟哪位季前赛射手？留言说说～",
    `完整筛选 → https://faleague-ai.com/zh/fpl/preseason`,
    "",
    "#FPL #FantasyPremierLeague #英超 #范特西足球 #季前赛 #开局阵容 #状态雷达 #FALEAGUE #选人思路",
  ].join("\n");
  writeFileSync(
    join(outDir, `preseason-results-${date}-caption.txt`),
    caption,
    "utf8",
  );

  console.log(`Wrote ${outPath}`);
  console.log(`clubs=${clubs.length} pages=${pages.length}`);
  for (const p of pages) {
    console.log(
      `p${p.page}: ${p.clubs.map((c) => c.short).join(" + ")}`,
    );
  }
}

main();
