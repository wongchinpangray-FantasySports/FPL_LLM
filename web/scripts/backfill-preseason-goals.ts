import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  needsPlScorerBackfill,
  preseasonGoalsChanged,
  preseasonGoalsComplete,
} from "../lib/fpl/preseason-scorers";
import {
  isPlausiblePreseasonScorerName,
  preseasonGoalsHaveInvalidRows,
} from "../lib/fpl/preseason-report-goals";
import type { PreseasonBundle, PreseasonMatch } from "../lib/fpl/preseason";

/** Curated PL scorers when scrapers fail (verified from BBC/Sky/club reports). */
const CURATED: Record<
  string,
  Array<{ minute: string; scorer: string; assist: string | null; side: "pl" | "opp" }>
> = {
  "eve-2026-08-12-18": [
    { minute: "27'", scorer: "Thierno Barry", assist: null, side: "pl" },
    { minute: "36'", scorer: "Iliman Ndiaye", assist: null, side: "pl" },
    { minute: "73'", scorer: "Tyrique George", assist: null, side: "pl" },
    { minute: "85'", scorer: "Harvey Barnes", assist: null, side: "opp" },
  ],
  "new-2026-08-12-31": [
    { minute: "85'", scorer: "Harvey Barnes", assist: null, side: "pl" },
    { minute: "27'", scorer: "Thierno Barry", assist: null, side: "opp" },
    { minute: "36'", scorer: "Iliman Ndiaye", assist: null, side: "opp" },
    { minute: "73'", scorer: "Tyrique George", assist: null, side: "opp" },
  ],
  "ars-2026-08-16-50": [
    { minute: "1'", scorer: "Riccardo Calafiori", assist: "Myles Lewis-Skelly", side: "pl" },
    { minute: "28'", scorer: "Kai Havertz", assist: "Christos Tzolis", side: "pl" },
    { minute: "48'", scorer: "Martin Odegaard", assist: null, side: "pl" },
  ],
  "tot-2026-08-15-101": [
    { minute: "35'", scorer: "Richarlison", assist: "Andrew Robertson", side: "pl" },
    { minute: "59'", scorer: "Mikey Moore", assist: "Mathys Tel", side: "pl" },
    { minute: "80'", scorer: "Mikey Moore", assist: "Mathys Tel", side: "pl" },
  ],
  "mun-2026-08-15-46": [
    { minute: "2'", scorer: "Harry Maguire", assist: "Bruno Fernandes", side: "pl" },
    { minute: "51'", scorer: "Patrick Dorgu", assist: null, side: "pl" },
    { minute: "37'", scorer: "Samuel Chukwueze", assist: null, side: "opp" },
    { minute: "57'", scorer: "Alphadjo Cisse", assist: null, side: "opp" },
    { minute: "68'", scorer: "Goncalo Ramos", assist: "Samuel Chukwueze", side: "opp" },
    { minute: "71'", scorer: "Ruben Loftus-Cheek", assist: null, side: "opp" },
  ],
  "bre-2026-08-15-63": [
    { minute: "2'", scorer: "Kevin Schade", assist: "Nathan Collins", side: "pl" },
    { minute: "12'", scorer: "Mamadou Sangare", assist: null, side: "pl" },
    { minute: "40'", scorer: "Igor Thiago", assist: "Kevin Schade", side: "pl" },
    { minute: "52'", scorer: "Dango Ouattara", assist: "Michael Kayode", side: "pl" },
    { minute: "57'", scorer: "Keane Lewis-Potter", assist: "Kevin Schade", side: "pl" },
    { minute: "68'", scorer: "Igor Thiago", assist: "Mathias Jensen", side: "pl" },
    { minute: "70'", scorer: "Kevin Schade", assist: "Igor Thiago", side: "pl" },
  ],
  "sun-2026-08-15-40": [
    { minute: "61'", scorer: "Brian Brobbey", assist: null, side: "pl" },
    { minute: "70'", scorer: "Trai Hume", assist: null, side: "pl" },
    { minute: "32'", scorer: "Esteban Lepaul", assist: null, side: "opp" },
  ],
  "new-2026-08-15-32": [
    { minute: "44'", scorer: "Malick Thiaw", assist: "Anthony Elanga", side: "pl" },
    { minute: "1'", scorer: "Ibrahim Maza", assist: null, side: "opp" },
    { minute: "82'", scorer: "Victor Boniface", assist: null, side: "opp" },
  ],
  "ips-2026-08-15-81": [
    { minute: "16'", scorer: "Jack Clarke", assist: "Leif Davis", side: "pl" },
    { minute: "41'", scorer: "Emersonn", assist: null, side: "pl" },
    { minute: "45'", scorer: "Dara O'Shea", assist: null, side: "pl" },
    { minute: "78'", scorer: "Kasey McAteer", assist: "Anis Mehmeti", side: "pl" },
    { minute: "9'", scorer: "Zeno Van den Bosch", assist: null, side: "opp" },
    { minute: "53'", scorer: "Josip Juranovic", assist: null, side: "opp" },
  ],
  "nfo-2026-08-12-25": [
    { minute: "4'", scorer: "Dan Ndoye", assist: null, side: "pl" },
    { minute: "90'", scorer: "Arnaud Kalimuendo", assist: "Luca Netz", side: "pl" },
    { minute: "32'", scorer: "Patrik Schick", assist: null, side: "opp" },
  ],
  "nfo-2026-08-16-26": [
    { minute: "", scorer: "Chris Wood", assist: null, side: "pl" },
    { minute: "", scorer: "Luca Netz", assist: "Nicolas Dominguez", side: "pl" },
  ],
  "new-2026-08-16-33": [
    { minute: "43'", scorer: "William Osula", assist: null, side: "pl" },
    { minute: "69'", scorer: "Gessime Yassine", assist: null, side: "opp" },
  ],
  "ful-2026-08-12-71": [
    { minute: "", scorer: "Ryan Sessegnon", assist: null, side: "pl" },
    { minute: "", scorer: "Alex Iwobi", assist: null, side: "pl" },
  ],
  "avl-2026-08-12-58": [
    { minute: "", scorer: "Jaden Madjo", assist: null, side: "pl" },
  ],
  "cov-2026-08-14-4": [
    { minute: "12'", scorer: "Ellis Simms", assist: null, side: "pl" },
    { minute: "33'", scorer: "Loum Tchaouna", assist: null, side: "pl" },
  ],
  "avl-2026-08-15-57": [
    { minute: "69'", scorer: "John McGinn", assist: "Emiliano Buendia", side: "pl" },
    { minute: "32'", scorer: "Tim Kleindienst", assist: null, side: "opp" },
    { minute: "35'", scorer: "Tim Kleindienst", assist: null, side: "opp" },
  ],
  "bha-2026-08-15-12": [
    { minute: "59'", scorer: "Jack Hinshelwood", assist: "Mats Wieffer", side: "pl" },
  ],
  "ful-2026-08-15-70": [
    { minute: "67'", scorer: "Timothy Castagne", assist: "Alex Iwobi", side: "pl" },
  ],
  "ars-2026-07-25-46": [
    { minute: "10'", scorer: "Reiss Nelson", assist: "Christos Tzolis", side: "pl" },
    { minute: "39'", scorer: "Ethan Nwaneri", assist: null, side: "pl" },
    { minute: "", scorer: "Ceadach O'Neill", assist: "Demiane Agustien", side: "pl" },
  ],
  "bre-2026-08-05-61": [
    { minute: "", scorer: "Mikkel Damsgaard", assist: null, side: "pl" },
    { minute: "", scorer: "Rico Henry", assist: null, side: "pl" },
    { minute: "", scorer: "Callum Wilson", assist: "Jaidon Anthony", side: "pl" },
    { minute: "89'", scorer: "Keane Lewis-Potter", assist: null, side: "pl" },
    { minute: "", scorer: "Emre Tezgel", assist: null, side: "opp" },
  ],
  "liv-2026-08-16-92": [
    { minute: "23'", scorer: "Cody Gakpo", assist: "Jeremie Frimpong", side: "pl" },
    { minute: "44'", scorer: "Jeremy Jacquet", assist: "Cody Gakpo", side: "pl" },
  ],
};

function goalsLookClean(
  match: PreseasonMatch,
  goals: PreseasonMatch["goals"],
): boolean {
  if (!goals.length) return false;
  if (goals.some((g) => !isPlausiblePreseasonScorerName(g.scorer, match))) {
    return false;
  }
  const pl = goals.filter((g) => g.side === "pl").length;
  return match.pl_goals != null && pl >= match.pl_goals;
}

async function main() {
  const path = join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const matches: PreseasonMatch[] = bundle.matches.map((m) => ({
    ...m,
    kickoff_time: m.kickoff_time ?? null,
    goals: m.goals ?? [],
  }));

  let updated = 0;
  let attempted = 0;

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i]!;
    if (m.status !== "finished") continue;
    if (m.pl_goals == null || m.opp_goals == null) continue;
    if (m.pl_goals + m.opp_goals === 0) continue;

    const curated = CURATED[m.id];
    if (curated) {
      if (preseasonGoalsChanged(m.goals, curated)) {
        matches[i] = { ...m, goals: curated };
        updated += 1;
        console.log(`Curated ${m.id}: ${curated.filter((g) => g.side === "pl").map((g) => g.scorer).join(", ")}`);
      }
      continue;
    }

    if (!needsPlScorerBackfill(m)) continue;
    attempted += 1;

    const cleaned = preseasonGoalsHaveInvalidRows(m)
      ? m.goals.filter((g) => isPlausiblePreseasonScorerName(g.scorer, m))
      : m.goals;
    const seed = { ...m, goals: cleaned };
    const urls = findReportUrlsForMatch(seed, []);
    console.log(`Fetch ${m.id} (${m.pl_goals}-${m.opp_goals} vs ${m.opponent})…`);
    const goals = await fetchGoalsForFinishedMatch(seed, urls, {
      skipDiscovery: false,
    });

    if (!goalsLookClean(m, goals)) {
      console.log(
        `  reject unclean: ${goals.filter((g) => g.side === "pl").map((g) => g.scorer).join(" | ") || "—"}`,
      );
      continue;
    }
    if (!preseasonGoalsChanged(m.goals, goals)) {
      console.log("  unchanged");
      continue;
    }
    matches[i] = { ...m, goals };
    updated += 1;
    console.log(
      `  ok: ${goals.filter((g) => g.side === "pl").map((g) => g.scorer).join(", ")}`,
    );
  }

  // Strip any residual junk rows across the file
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i]!;
    if (!m.goals?.length) continue;
    const next = m.goals.filter((g) =>
      isPlausiblePreseasonScorerName(g.scorer, m),
    );
    if (next.length !== m.goals.length) {
      matches[i] = { ...m, goals: next };
      updated += 1;
      console.log(`Cleaned junk on ${m.id}`);
    }
  }

  if (updated === 0) {
    console.log(`No updates (attempted fetches ${attempted}).`);
    return;
  }

  const out: PreseasonBundle = {
    ...bundle,
    updated_at: new Date().toISOString().slice(0, 10),
    matches,
  };
  writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(`Wrote ${updated} updates to ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
