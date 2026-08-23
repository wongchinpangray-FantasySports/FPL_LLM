/**
 * Build per-club preseason G/A summary JSON for XHS posters.
 *   npx tsx scripts/build-xhs-preseason-ga.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle } from "../lib/fpl/preseason";
import { isPlausiblePreseasonScorerName } from "../lib/fpl/preseason-report-goals";

const PL_CODES = new Set([
  "ARS",
  "AVL",
  "BOU",
  "BRE",
  "BHA",
  "CHE",
  "CRY",
  "EVE",
  "FUL",
  "IPS",
  "LEE",
  "LIV",
  "MCI",
  "MUN",
  "NEW",
  "NFO",
  "SUN",
  "TOT",
  "WHU",
  "WOL",
]);

type PlayerCount = { name: string; count: number };
type ClubRow = {
  pl_code: string;
  pl_name: string;
  short: string;
  badge: string | null;
  goals: number;
  assists: number;
  scorers: PlayerCount[];
  assists_list: PlayerCount[];
  scorers_line: string;
  assists_line: string;
};

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
    .trim();
}

function formatPlayerList(rows: PlayerCount[], max = 3): string {
  return rows
    .slice(0, max)
    .map((p) => (p.count > 1 ? `${shortName(p.name)}×${p.count}` : shortName(p.name)))
    .join(" · ");
}

function shortName(name: string): string {
  const cleaned = name
    .replace(/^Ben Gannon-Doak$/i, "Doak")
    .replace(/^Jo[aã]o Pedro$/i, "J.Pedro")
    .replace(/^Enzo Le F[eé]e$|^Enzo Le Fee$/i, "Le Fée")
    .trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length <= 1) return cleaned;
  // Keep compound surnames: Calvert-Lewin, Gibbs-White
  const last = parts[parts.length - 1]!;
  if (last.includes("-") || last.length >= 5) return last;
  if (parts.length >= 2 && parts[parts.length - 2]!.length <= 3) {
    return `${parts[parts.length - 2]} ${last}`;
  }
  return last;
}

function main() {
  const path = join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const map = new Map<string, ClubRow>();

  for (const match of bundle.matches) {
    if (match.status !== "finished") continue;
    if (!PL_CODES.has(match.pl_code)) continue;

    let row = map.get(match.pl_code);
    if (!row) {
      row = {
        pl_code: match.pl_code,
        pl_name: match.pl_name,
        short: shortClub(match.pl_name),
        badge: null,
        goals: 0,
        assists: 0,
        scorers: [],
        assists_list: [],
        scorers_line: "",
        assists_line: "",
      };
      map.set(match.pl_code, row);
    }

    const scorerCounts = new Map<string, PlayerCount>();
    const assistCounts = new Map<string, PlayerCount>();
    // seed from existing
    for (const s of row.scorers) scorerCounts.set(s.name.toLowerCase(), { ...s });
    for (const a of row.assists_list)
      assistCounts.set(a.name.toLowerCase(), { ...a });

    for (const g of match.goals ?? []) {
      if (g.side !== "pl") continue;
      if (
        typeof g.scorer === "string" &&
        isPlausiblePreseasonScorerName(g.scorer, match)
      ) {
        const key = g.scorer.toLowerCase();
        const cur = scorerCounts.get(key);
        if (cur) cur.count += 1;
        else scorerCounts.set(key, { name: g.scorer, count: 1 });
        row.goals += 1;
      }
      const assist = g.assist?.trim();
      if (assist && isPlausiblePreseasonScorerName(assist, match)) {
        const key = assist.toLowerCase();
        const cur = assistCounts.get(key);
        if (cur) cur.count += 1;
        else assistCounts.set(key, { name: assist, count: 1 });
        row.assists += 1;
      }
    }

    row.scorers = [...scorerCounts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    row.assists_list = [...assistCounts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
    row.scorers_line = formatPlayerList(row.scorers, 4) || "暂无进球详情";
    row.assists_line =
      formatPlayerList(row.assists_list, 3) ||
      (row.goals > 0 ? "报告未收录助攻" : "暂无助攻");
  }

  const clubs = [...map.values()].sort((a, b) => {
    const diff = b.goals - a.goals || b.assists - a.assists;
    return diff !== 0 ? diff : a.short.localeCompare(b.short);
  });

  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const half = 8; // keep page 1 uncrowded (taller dual-line rows)
  const pages = [
    {
      page: 1,
      total_pages: 2,
      clubs: clubs.slice(0, half),
    },
    {
      page: 2,
      total_pages: 2,
      clubs: clubs.slice(half),
    },
  ];

  const out = {
    kind: "preseason-ga",
    date,
    season: bundle.season,
    title: "季前赛进球 & 助攻榜",
    subtitle: "英超各队至今 · 进球 / 助攻分行显示 · 助攻依战报收录",
    total_clubs: clubs.length,
    total_goals: clubs.reduce((n, c) => n + c.goals, 0),
    total_assists: clubs.reduce((n, c) => n + c.assists, 0),
    clubs,
    pages,
  };

  const outDir = join(process.cwd(), "output", "xhs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `preseason-ga-${date}.json`);
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(
    `clubs=${clubs.length} goals=${out.total_goals} assists=${out.total_assists}`,
  );
  for (const c of clubs) {
    console.log(
      `${c.short.padEnd(12)} G${c.goals} A${c.assists}`,
    );
    console.log(`  进球 ${c.scorers_line}`);
    console.log(`  助攻 ${c.assists_line}`);
  }
}

main();
