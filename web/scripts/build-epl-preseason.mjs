/**
 * Build epl-preseason-2627.json from Premier League official pre-season list.
 * Source: https://www.premierleague.com/en/news/4606700/premier-league-clubs-2026-pre-season-fixtures-and-results
 *
 * Run: node web/scripts/build-epl-preseason.mjs
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../data/epl-preseason-2627.json");

const SOURCE_URL =
  "https://www.premierleague.com/en/news/4606700/premier-league-clubs-2026-pre-season-fixtures-and-results";

/** @type {Array<{ date: string, pl: string, opponent: string, home: boolean, pl_goals?: number, opp_goals?: number, venue?: string, note?: string }>} */
const ROWS = [
  // Brentford
  { date: "2026-07-15", pl: "BRE", opponent: "AFC Wimbledon", home: true, pl_goals: 3, opp_goals: 2 },
  // Coventry
  { date: "2026-07-11", pl: "COV", opponent: "Wimbledon", home: false, pl_goals: 2, opp_goals: 3, note: "Behind closed doors" },
  { date: "2026-07-18", pl: "COV", opponent: "Northampton Town", home: false, pl_goals: 0, opp_goals: 0 },
  { date: "2026-08-08", pl: "COV", opponent: "Espanyol", home: true },
  { date: "2026-08-14", pl: "COV", opponent: "Monaco", home: true },
  // Crystal Palace
  { date: "2026-07-18", pl: "CRY", opponent: "Swindon", home: true, pl_goals: 5, opp_goals: 1, venue: "Crystal Palace Academy" },
  { date: "2026-07-28", pl: "CRY", opponent: "Lens", home: false, venue: "Lake Como" },
  { date: "2026-07-28", pl: "CRY", opponent: "Famalicao", home: false, venue: "Lake Como" },
  // Brighton
  { date: "2026-07-18", pl: "BHA", opponent: "Wycombe Wanderers", home: true, pl_goals: 4, opp_goals: 1 },
  { date: "2026-07-25", pl: "BHA", opponent: "Annecy", home: true, note: "Behind closed doors" },
  { date: "2026-08-01", pl: "BHA", opponent: "Strasbourg", home: true, note: "Behind closed doors" },
  { date: "2026-08-08", pl: "BHA", opponent: "Roma", home: true },
  { date: "2026-08-15", pl: "BHA", opponent: "Bologna", home: true },
  // Everton
  { date: "2026-07-18", pl: "EVE", opponent: "Dundee", home: false, pl_goals: 4, opp_goals: 0 },
  { date: "2026-07-25", pl: "EVE", opponent: "Bolton", home: false },
  { date: "2026-07-28", pl: "EVE", opponent: "Stoke", home: false },
  { date: "2026-08-01", pl: "EVE", opponent: "Hamburg", home: false },
  { date: "2026-08-08", pl: "EVE", opponent: "Stuttgart", home: false },
  { date: "2026-08-12", pl: "EVE", opponent: "Newcastle", home: true, venue: "Edinburgh" },
  // Nott'm Forest
  { date: "2026-07-18", pl: "NFO", opponent: "Notts County", home: false, pl_goals: 2, opp_goals: 0 },
  { date: "2026-07-22", pl: "NFO", opponent: "Blackburn", home: true, venue: "Albufeira" },
  { date: "2026-07-26", pl: "NFO", opponent: "Vitoria", home: true, note: "Behind closed doors" },
  { date: "2026-07-31", pl: "NFO", opponent: "Sporting", home: true, venue: "Faro" },
  { date: "2026-08-08", pl: "NFO", opponent: "Udinese", home: false, venue: "Udine" },
  { date: "2026-08-08", pl: "NFO", opponent: "Barcelona", home: false, venue: "Udine" },
  { date: "2026-08-12", pl: "NFO", opponent: "Bayer Leverkusen", home: true },
  { date: "2026-08-16", pl: "NFO", opponent: "Brest", home: true },
  // Newcastle
  { date: "2026-07-18", pl: "NEW", opponent: "Darlington", home: true, pl_goals: 3, opp_goals: 0, note: "Behind closed doors" },
  { date: "2026-07-25", pl: "NEW", opponent: "Gateshead", home: false },
  { date: "2026-07-29", pl: "NEW", opponent: "Bristol City", home: false },
  { date: "2026-08-08", pl: "NEW", opponent: "Valencia", home: false },
  { date: "2026-08-12", pl: "NEW", opponent: "Everton", home: true, venue: "Edinburgh" },
  { date: "2026-08-15", pl: "NEW", opponent: "Bayer Leverkusen", home: true },
  { date: "2026-08-16", pl: "NEW", opponent: "Strasbourg", home: true },
  // Sunderland
  { date: "2026-07-18", pl: "SUN", opponent: "York City", home: false, pl_goals: 5, opp_goals: 1, venue: "York" },
  { date: "2026-07-25", pl: "SUN", opponent: "Liverpool", home: true, venue: "Nashville" },
  { date: "2026-07-30", pl: "SUN", opponent: "Leeds", home: true, venue: "New Jersey" },
  { date: "2026-08-02", pl: "SUN", opponent: "Wrexham", home: true, venue: "Philadelphia" },
  { date: "2026-08-08", pl: "SUN", opponent: "Lens", home: false, note: "Behind closed doors" },
  { date: "2026-08-08", pl: "SUN", opponent: "Lens", home: false, venue: "Lens" },
  { date: "2026-08-15", pl: "SUN", opponent: "Rennes", home: true, venue: "Stadium of Light" },
  // Man Utd
  { date: "2026-07-18", pl: "MUN", opponent: "Wrexham", home: true, pl_goals: 0, opp_goals: 1, venue: "Helsinki" },
  { date: "2026-07-24", pl: "MUN", opponent: "Rosenborg", home: false, venue: "Trondheim" },
  { date: "2026-08-01", pl: "MUN", opponent: "Atletico Madrid", home: true, venue: "Stockholm" },
  { date: "2026-08-08", pl: "MUN", opponent: "Paris Saint-Germain", home: true, venue: "Gothenburg" },
  { date: "2026-08-12", pl: "MUN", opponent: "Leeds", home: true, venue: "Dublin" },
  { date: "2026-08-15", pl: "MUN", opponent: "AC Milan", home: true, venue: "Wroclaw" },
  // Arsenal
  { date: "2026-08-01", pl: "ARS", opponent: "Girona", home: false },
  { date: "2026-08-05", pl: "ARS", opponent: "Real Betis", home: true, venue: "Dublin" },
  { date: "2026-08-09", pl: "ARS", opponent: "Borussia Dortmund", home: true },
  { date: "2026-08-16", pl: "ARS", opponent: "Man City", home: true, venue: "Cardiff", note: "FA Community Shield" },
  // Aston Villa
  { date: "2026-07-21", pl: "AVL", opponent: "Walsall", home: false },
  { date: "2026-07-25", pl: "AVL", opponent: "Porto", home: false },
  { date: "2026-07-28", pl: "AVL", opponent: "Real Sociedad", home: true, venue: "Walsall" },
  { date: "2026-08-01", pl: "AVL", opponent: "Indonesia All-Stars", home: true, venue: "Jakarta" },
  { date: "2026-08-04", pl: "AVL", opponent: "BG Pathum United", home: true, venue: "Pathum Thani" },
  { date: "2026-08-07", pl: "AVL", opponent: "Bayern Munich", home: true, venue: "Hong Kong" },
  { date: "2026-08-15", pl: "AVL", opponent: "Borussia Monchengladbach", home: false },
  // Bournemouth
  { date: "2026-07-24", pl: "BOU", opponent: "St. Pauli", home: true, venue: "Saalfelden" },
  { date: "2026-07-30", pl: "BOU", opponent: "Augsburg", home: true, venue: "Saalfelden" },
  { date: "2026-08-04", pl: "BOU", opponent: "Genoa", home: true, note: "Behind closed doors" },
  { date: "2026-08-08", pl: "BOU", opponent: "Real Betis", home: false, venue: "Seville" },
  // Brentford (upcoming)
  { date: "2026-08-08", pl: "BRE", opponent: "Rennes", home: false },
  { date: "2026-08-15", pl: "BRE", opponent: "Eintracht Frankfurt", home: true, venue: "London" },
  // Chelsea
  { date: "2026-07-28", pl: "CHE", opponent: "Western Sydney Wanderers", home: false, venue: "Sydney" },
  { date: "2026-08-01", pl: "CHE", opponent: "Spurs", home: true, venue: "Sydney" },
  { date: "2026-08-05", pl: "CHE", opponent: "Juventus", home: true, venue: "Hong Kong" },
  { date: "2026-08-08", pl: "CHE", opponent: "AC Milan", home: true, venue: "Jakarta" },
  { date: "2026-08-09", pl: "CHE", opponent: "Johor Darul Ta'zim", home: true, venue: "Johor" },
  // Fulham
  { date: "2026-07-28", pl: "FUL", opponent: "Al-Ahli", home: false },
  { date: "2026-08-15", pl: "FUL", opponent: "Stuttgart", home: true },
  // Hull
  { date: "2026-07-25", pl: "HUL", opponent: "Konyaspor", home: true, venue: "Slovenia" },
  { date: "2026-07-28", pl: "HUL", opponent: "Caykur Rizespor", home: true, venue: "Slovenia" },
  { date: "2026-08-01", pl: "HUL", opponent: "Kasimpasa", home: false, venue: "Istanbul" },
  { date: "2026-08-08", pl: "HUL", opponent: "Eintracht Frankfurt", home: false },
  { date: "2026-08-15", pl: "HUL", opponent: "OGC Nice", home: true },
  // Ipswich
  { date: "2026-07-29", pl: "IPS", opponent: "Osasuna", home: true, venue: "Colchester" },
  { date: "2026-08-01", pl: "IPS", opponent: "Oxford Utd", home: false },
  { date: "2026-08-01", pl: "IPS", opponent: "Wycombe", home: false },
  { date: "2026-08-04", pl: "IPS", opponent: "Le Havre", home: true },
  { date: "2026-08-08", pl: "IPS", opponent: "Rayo Vallecano", home: true },
  { date: "2026-08-15", pl: "IPS", opponent: "Union Berlin", home: false, venue: "Berlin" },
  // Leeds
  { date: "2026-07-25", pl: "LEE", opponent: "Wrexham", home: true, venue: "Tampa" },
  { date: "2026-07-30", pl: "LEE", opponent: "Sunderland", home: true, venue: "New Jersey" },
  { date: "2026-08-02", pl: "LEE", opponent: "Liverpool", home: true, venue: "Chicago" },
  { date: "2026-08-08", pl: "LEE", opponent: "RB Leipzig", home: true },
  { date: "2026-08-12", pl: "LEE", opponent: "Man Utd", home: true, venue: "Dublin" },
  // Liverpool
  { date: "2026-07-25", pl: "LIV", opponent: "Sunderland", home: true, venue: "Nashville" },
  { date: "2026-07-29", pl: "LIV", opponent: "Wrexham", home: true, venue: "New York" },
  { date: "2026-08-02", pl: "LIV", opponent: "Leeds", home: true, venue: "Chicago" },
  { date: "2026-08-09", pl: "LIV", opponent: "Monaco", home: true, venue: "Anfield" },
  { date: "2026-08-16", pl: "LIV", opponent: "Como", home: true, venue: "Anfield" },
  // Man City
  { date: "2026-08-01", pl: "MCI", opponent: "Inter Milan", home: true, venue: "Hong Kong" },
  { date: "2026-08-05", pl: "MCI", opponent: "K-League All-Stars", home: true, venue: "Seoul" },
  { date: "2026-08-09", pl: "MCI", opponent: "Atletico Madrid", home: true, venue: "Seoul" },
  { date: "2026-08-16", pl: "MCI", opponent: "Arsenal", home: true, venue: "Cardiff", note: "FA Community Shield" },
  // Spurs
  { date: "2026-07-22", pl: "TOT", opponent: "MK Dons", home: true, note: "Behind closed doors" },
  { date: "2026-07-26", pl: "TOT", opponent: "Auckland FC", home: false, venue: "Auckland" },
  { date: "2026-07-29", pl: "TOT", opponent: "Sydney FC", home: false, venue: "Sydney" },
  { date: "2026-08-01", pl: "TOT", opponent: "Chelsea", home: true, venue: "Sydney" },
  { date: "2026-08-08", pl: "TOT", opponent: "Getafe", home: true, note: "Behind closed doors" },
  { date: "2026-08-15", pl: "TOT", opponent: "Hoffenheim", home: true },
  { date: "2026-08-16", pl: "TOT", opponent: "Hoffenheim", home: true, note: "Behind closed doors" },
];

const PL_NAMES = {
  ARS: "Arsenal",
  AVL: "Aston Villa",
  BOU: "Bournemouth",
  BRE: "Brentford",
  BHA: "Brighton",
  CHE: "Chelsea",
  COV: "Coventry City",
  CRY: "Crystal Palace",
  EVE: "Everton",
  FUL: "Fulham",
  HUL: "Hull City",
  IPS: "Ipswich Town",
  LEE: "Leeds United",
  LIV: "Liverpool",
  MCI: "Man City",
  MUN: "Man Utd",
  NEW: "Newcastle",
  NFO: "Nott'm Forest",
  SUN: "Sunderland",
  TOT: "Spurs",
};

const matches = ROWS.map((row, i) => {
  const finished = row.pl_goals != null && row.opp_goals != null;
  return {
    id: `${row.pl.toLowerCase()}-${row.date}-${i}`,
    date: row.date,
    pl_code: row.pl,
    pl_name: PL_NAMES[row.pl] ?? row.pl,
    opponent: row.opponent,
    pl_home: row.home,
    venue: row.venue ?? null,
    note: row.note ?? null,
    status: finished ? "finished" : "scheduled",
    pl_goals: row.pl_goals ?? null,
    opp_goals: row.opp_goals ?? null,
  };
});

matches.sort((a, b) => a.date.localeCompare(b.date) || a.pl_code.localeCompare(b.pl_code));

const payload = {
  season: "2026/27",
  source: SOURCE_URL,
  updated_at: new Date().toISOString().slice(0, 10),
  matches,
};

writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${matches.length} matches to ${OUT}`);
