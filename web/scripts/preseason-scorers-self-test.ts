/**
 * Lightweight regression checks for pre-season goal completeness helpers.
 */
import {
  parseGenericMatchReportGoals,
  parseManUtdEmbeddedGoals,
  reportHtmlMatchesFixture,
} from "../lib/fpl/preseason-report-goals";
import type { PreseasonGoal } from "../lib/fpl/preseason-enrich";
import {
  mergePreseasonGoalLists,
  needsPreseasonGoalFetch,
  preseasonGoalsComplete,
} from "../lib/fpl/preseason-scorers";

function assert(name: string, cond: boolean): void {
  if (!cond) {
    console.error(`FAIL: ${name}`);
    process.exit(1);
  }
  console.log(`ok: ${name}`);
}

const base = {
  date: "2026-07-24",
  pl_code: "BOU",
  pl_name: "Bournemouth",
  opponent: "St. Pauli",
  pl_home: true,
  status: "finished" as const,
  pl_goals: 4,
  opp_goals: 1,
};

assert(
  "0-0 is complete without goal rows",
  preseasonGoalsComplete({ ...base, pl_goals: 0, opp_goals: 0, goals: [] }),
);

assert(
  "4-1 with four PL goals only is incomplete",
  !preseasonGoalsComplete({
    ...base,
    goals: [
      { minute: "10'", scorer: "A", assist: null, side: "pl" },
      { minute: "20'", scorer: "B", assist: null, side: "pl" },
      { minute: "30'", scorer: "C", assist: null, side: "pl" },
      { minute: "40'", scorer: "D", assist: null, side: "pl" },
    ],
  }),
);

assert(
  "needs fetch when opponent goal missing",
  needsPreseasonGoalFetch({
    ...base,
    goals: [
      { minute: "", scorer: "A", assist: null, side: "pl" },
      { minute: "", scorer: "B", assist: null, side: "pl" },
      { minute: "", scorer: "C", assist: null, side: "pl" },
    ],
  }),
);

const partialApi: PreseasonGoal[] = [
  { minute: "12'", scorer: "PL One", assist: null, side: "pl" },
  { minute: "34'", scorer: "PL Two", assist: null, side: "pl" },
  { minute: "55'", scorer: "PL Three", assist: null, side: "pl" },
];

const espnOpp: PreseasonGoal[] = [
  { minute: "", scorer: "Opp Scorer", assist: null, side: "opp" },
];

const merged = mergePreseasonGoalLists(
  { ...base, pl_goals: 3, opp_goals: 2 },
  partialApi,
  espnOpp,
);

assert(
  "merge keeps API minutes and adds opponent goal",
  merged.length === 4 &&
    merged.some((g) => g.side === "opp" && g.scorer === "Opp Scorer") &&
    merged.filter((g) => g.side === "pl").every((g) => g.minute.endsWith("'")),
);

const manUtdHtml =
  String.raw`{\"event\":\"Goal\",\"clubId\":\"x\",\"minute\":\"31'\",\"playerId\":\"a\",\"sortOrder\":1,\"playerName\":\"Shea Lacey\"}` +
  String.raw`{\"event\":\"Goal\",\"clubId\":\"x\",\"minute\":\"56'\",\"playerId\":\"b\",\"sortOrder\":2,\"playerName\":\"Joshua Zirkzee\"}`;

const munMatch = {
  date: "2026-07-24",
  pl_code: "MUN",
  pl_name: "Man Utd",
  opponent: "Rosenborg",
  pl_home: false,
  status: "finished" as const,
  pl_goals: 5,
  opp_goals: 0,
};

assert(
  "man utd embedded goals parse with minutes",
  parseManUtdEmbeddedGoals(manUtdHtml, munMatch).some(
    (g) => g.scorer === "Shea Lacey" && g.minute === "31'",
  ),
);

assert(
  "sky timeline extracts minute and scorer",
  parseGenericMatchReportGoals(
    "31: GOAL! Lacey gives United the lead. 56: GOAL! Zirkzee produces moment of magic.",
    munMatch,
  ).length >= 2,
);

const stPauliBbc =
  "<p>Marco Rose kicked off his Bournemouth reign with a 4-1 victory over German side St. Pauli in the Cherries opening pre-season fixture.</p>" +
  "<p>goals from Ben Gannon-Doak, Harold William, Daniel Jebbison and Bafode Diakite helped Bournemouth seal a victory.</p>";

const stPauliMatch = {
  ...base,
  opponent: "St. Pauli",
  pl_goals: 4,
  opp_goals: 1,
};

const augsburgMatch = {
  ...base,
  opponent: "Augsburg",
  pl_goals: 5,
  opp_goals: 2,
  date: "2026-07-30",
};

assert(
  "st pauli bbc html matches st pauli fixture",
  reportHtmlMatchesFixture(stPauliBbc, stPauliMatch),
);

assert(
  "st pauli bbc html rejected for augsburg fixture",
  !reportHtmlMatchesFixture(stPauliBbc, augsburgMatch),
);

assert(
  "st pauli bbc parses four scorers",
  parseGenericMatchReportGoals(stPauliBbc, stPauliMatch).filter((g) => g.side === "pl")
    .length === 4,
);

const augsburgBbc =
  "<p>Bournemouth concluded their pre-season tour in Austria with an emphatic 5-2 victory over Augsburg in Saalfelden.</p>" +
  "<p>Tavernier, Evanilson, Alex Toth, Ben Gannon-Doak and Enes Unal were all on the scoresheet.</p>";

assert(
  "augsburg bbc html matches augsburg fixture",
  reportHtmlMatchesFixture(augsburgBbc, augsburgMatch),
);

assert(
  "augsburg bbc parses five scorers",
  parseGenericMatchReportGoals(augsburgBbc, augsburgMatch).filter((g) => g.side === "pl")
    .length === 5,
);

console.log("Pre-season scorers self-test passed.");
