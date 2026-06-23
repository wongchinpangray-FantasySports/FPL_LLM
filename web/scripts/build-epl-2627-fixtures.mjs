/**
 * Build bundled 2026/27 Premier League fixtures from fixturedownload.com export.
 * Run: node web/scripts/build-epl-2627-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../data/epl-2627-fixtures.json");

const TEAM_CODES = {
  Arsenal: "ARS",
  "Aston Villa": "AVL",
  Bournemouth: "BOU",
  Brentford: "BRE",
  Brighton: "BHA",
  Chelsea: "CHE",
  Coventry: "COV",
  "Crystal Palace": "CRY",
  Everton: "EVE",
  Fulham: "FUL",
  Hull: "HUL",
  Ipswich: "IPS",
  Leeds: "LEE",
  Liverpool: "LIV",
  "Man City": "MCI",
  "Man Utd": "MUN",
  Newcastle: "NEW",
  "Nott'm Forest": "NFO",
  Spurs: "TOT",
  Sunderland: "SUN",
};

const TEAM_NAMES = {
  ARS: "Arsenal",
  AVL: "Aston Villa",
  BOU: "Bournemouth",
  BRE: "Brentford",
  BHA: "Brighton",
  CHE: "Chelsea",
  COV: "Coventry",
  CRY: "Crystal Palace",
  EVE: "Everton",
  FUL: "Fulham",
  HUL: "Hull",
  IPS: "Ipswich",
  LEE: "Leeds",
  LIV: "Liverpool",
  MCI: "Man City",
  MUN: "Man Utd",
  NEW: "Newcastle",
  NFO: "Nott'm Forest",
  TOT: "Spurs",
  SUN: "Sunderland",
};

function parseKickoff(dateStr) {
  const [d, m, y, time] = dateStr.match(
    /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2})/,
  ).slice(1);
  return `${y}-${m}-${d}T${time}:00`;
}

async function loadFixtures() {
  const urls = [
    "https://fixturedownload.com/feed/json/epl-2026",
    "https://fixturedownload.com/feed/csv/epl-2026",
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FPL-LLM-fixture-sync/1.0" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (url.endsWith(".json")) {
        const data = JSON.parse(text);
        return data.map((row, idx) => ({
          id: idx + 1,
          gw: Number(row.RoundNumber ?? row.MatchNumber ?? row.Gameweek),
          home: TEAM_CODES[row.HomeTeam] ?? row.HomeTeam,
          away: TEAM_CODES[row.AwayTeam] ?? row.AwayTeam,
          kickoff: row.DateUtc ?? row.Date,
        }));
      }
      return parseCsv(text);
    } catch {
      /* try next */
    }
  }
  throw new Error("Could not download fixtures from fixturedownload.com");
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const fixtures = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 5) continue;
    const gw = Number(cols[0]);
    const home = TEAM_CODES[cols[3]?.trim()] ?? cols[3]?.trim();
    const away = TEAM_CODES[cols[4]?.trim()] ?? cols[4]?.trim();
    fixtures.push({
      id: i,
      gw,
      home,
      away,
      kickoff: cols[1]?.trim() ?? null,
    });
  }
  return fixtures;
}

function parseMarkdownTable(text) {
  const fixtures = [];
  let id = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\|\s*(\d+)\s*\|\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s*\|[^|]+\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/,
    );
    if (!m) continue;
    id += 1;
    const home = TEAM_CODES[m[3].trim()];
    const away = TEAM_CODES[m[4].trim()];
    if (!home || !away) {
      throw new Error(`Unknown team: ${m[3].trim()} vs ${m[4].trim()}`);
    }
    fixtures.push({
      id,
      gw: Number(m[1]),
      home,
      away,
      kickoff: parseKickoff(m[2]),
    });
  }
  return fixtures;
}

async function main() {
  let fixtures;
  const bundled = path.join(__dirname, "epl-2627-fixtures-source.md");
  if (fs.existsSync(bundled)) {
    fixtures = parseMarkdownTable(fs.readFileSync(bundled, "utf8"));
    console.log(`Parsed ${fixtures.length} fixtures from bundled source`);
  } else {
    fixtures = await loadFixtures();
  }

  if (fixtures.length !== 380) {
    throw new Error(`Expected 380 fixtures, got ${fixtures.length}`);
  }

  const codes = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))].sort();
  const teams = codes.map((code, idx) => ({
    id: idx + 1,
    code,
    short: code,
    name: TEAM_NAMES[code] ?? code,
  }));

  const codeToId = Object.fromEntries(teams.map((t) => [t.code, t.id]));
  const normalized = fixtures.map((f) => ({
    id: f.id,
    gw: f.gw,
    home_team_id: codeToId[f.home],
    away_team_id: codeToId[f.away],
    kickoff_time: f.kickoff,
  }));

  const payload = {
    season: "2026",
    source: "premierleague.com 2026/27 release via fixturedownload.com",
    teams,
    fixtures: normalized,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${normalized.length} fixtures, ${teams.length} teams -> ${OUT}`);
  console.log("Teams:", teams.map((t) => t.code).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
