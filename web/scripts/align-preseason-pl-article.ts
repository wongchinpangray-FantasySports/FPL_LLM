/**
 * Align key fixtures with the official PL pre-season article:
 * https://www.premierleague.com/en/news/4606700/premier-league-clubs-2026-pre-season-fixtures-and-results
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle, PreseasonMatch } from "../lib/fpl/preseason";

const path = join(process.cwd(), "data/epl-preseason-2627.json");
const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
const matches = [...bundle.matches] as PreseasonMatch[];

function upsert(match: PreseasonMatch) {
  const idx = matches.findIndex((m) => m.id === match.id);
  if (idx >= 0) matches[idx] = { ...matches[idx], ...match, goals: match.goals };
  else matches.push(match);
}

function patch(
  id: string,
  patch: Partial<PreseasonMatch> & { goals?: PreseasonMatch["goals"] },
) {
  const idx = matches.findIndex((m) => m.id === id);
  if (idx < 0) {
    console.warn("missing", id);
    return;
  }
  matches[idx] = {
    ...matches[idx]!,
    ...patch,
    goals: patch.goals ?? matches[idx]!.goals,
  };
  console.log("patched", id, patch.pl_goals, patch.opp_goals, patch.note ?? "");
}

// Spurs vs Hoffenheim BCD — PL: 2-2 (was wrongly 3-0)
patch("tot-2026-08-16-102", {
  pl_goals: 2,
  opp_goals: 2,
  status: "finished",
  note: "Behind closed doors",
  goals: [
    { minute: "", scorer: "Ben Davies", assist: null, side: "pl" },
    { minute: "", scorer: "Williams-Barnett", assist: null, side: "pl" },
  ],
});

// Brighton Annecy — finish (club friendly played; PL club list omits some lower-profile games)
patch("bha-2026-07-25-9", {
  status: "finished",
  pl_goals: 3,
  opp_goals: 0,
  goals: matches.find((m) => m.id === "bha-2026-07-25-9")?.goals?.length
    ? matches.find((m) => m.id === "bha-2026-07-25-9")!.goals
    : [],
});

upsert({
  id: "ars-2026-07-25-46",
  date: "2026-07-25",
  pl_code: "ARS",
  pl_name: "Arsenal",
  opponent: "MK Dons",
  pl_home: true,
  venue: null,
  note: null,
  status: "finished",
  pl_goals: 3,
  opp_goals: 0,
  kickoff_time: null,
  goals: [],
  lineup: null,
});
console.log("upserted ars-2026-07-25-46 MK Dons 3-0");

upsert({
  id: "bre-2026-08-05-61",
  date: "2026-08-05",
  pl_code: "BRE",
  pl_name: "Brentford",
  opponent: "Wycombe",
  pl_home: true,
  venue: null,
  note: null,
  status: "finished",
  pl_goals: 4,
  opp_goals: 1,
  kickoff_time: null,
  goals: [],
  lineup: null,
});
console.log("upserted bre-2026-08-05-61 Wycombe 4-1");

upsert({
  id: "che-2026-08-15-69",
  date: "2026-08-15",
  pl_code: "CHE",
  pl_name: "Chelsea",
  opponent: "Real Sociedad",
  pl_home: true,
  venue: "Stamford Bridge",
  note: null,
  status: "finished",
  pl_goals: 3,
  opp_goals: 1,
  kickoff_time: null,
  goals: [
    { minute: "10'", scorer: "Morgan Rogers", assist: null, side: "pl" },
    { minute: "", scorer: "João Pedro", assist: null, side: "pl" },
    { minute: "", scorer: "João Pedro", assist: null, side: "pl" },
  ],
  lineup: null,
});
console.log("upserted che-2026-08-15-69 Real Sociedad 3-1");

upsert({
  id: "liv-2026-08-16-92",
  date: "2026-08-16",
  pl_code: "LIV",
  pl_name: "Liverpool",
  opponent: "Como",
  pl_home: true,
  venue: null,
  note: null,
  status: "finished",
  pl_goals: 2,
  opp_goals: 0,
  kickoff_time: null,
  goals: [],
  lineup: null,
});
console.log("upserted liv-2026-08-16-92 Como 2-0");

// Keep BCD note on the 0-0 Como
patch("liv-2026-08-16-91", {
  note: "Behind closed doors",
});

matches.sort(
  (a, b) =>
    a.date.localeCompare(b.date) ||
    a.pl_code.localeCompare(b.pl_code) ||
    a.id.localeCompare(b.id),
);

const next: PreseasonBundle = {
  ...bundle,
  source:
    "https://www.premierleague.com/en/news/4606700/premier-league-clubs-2026-pre-season-fixtures-and-results",
  updated_at: new Date().toISOString().slice(0, 10),
  matches,
};
writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log("wrote", matches.length, "matches");
