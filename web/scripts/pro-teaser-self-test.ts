/**
 * Leak-safe teaser helpers (no FPL / DB).
 * Run: npx tsx scripts/pro-teaser-self-test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildTeaserProblems,
  formatOverallRank,
  parseTeaserEntryId,
  redactedPlanLine,
  teaserLeakReasons,
  type TeaserProblemFacts,
  type TeaserSquadFlag,
} from "../lib/billing/pro-teaser";

const flags: TeaserSquadFlag[] = [
  {
    web_name: "Richards",
    position: "DEF",
    team: "Crystal Palace",
    team_id: 7,
    is_starter: true,
    slot: 2,
    status: "a",
    chance: 100,
  },
  {
    web_name: "Mitchell",
    position: "DEF",
    team: "Crystal Palace",
    team_id: 7,
    is_starter: true,
    slot: 3,
    status: "a",
    chance: 100,
  },
  {
    web_name: "E.Le Fée",
    position: "MID",
    team: "Sunderland",
    team_id: 20,
    is_starter: true,
    slot: 8,
    status: "d",
    chance: 25,
  },
];

const facts: TeaserProblemFacts = {
  locale: "zh",
  bank: 1,
  freeTransfers: 1,
  chipsAllRemaining: true,
  league: { name: "AI League", rank: 16, gap: 63 },
  flags,
  clubDefStacks: [{ team: "Crystal Palace", n: 2, leaky: true }],
  pointsOnBenchLast: 8,
};

const problems = buildTeaserProblems(facts);
assert.equal(problems.length, 3);
assert.ok(problems.some((p) => p.kind === "injury"));
assert.ok(problems.some((p) => p.kind === "league_gap"));
assert.ok(
  problems.find((p) => p.kind === "league_gap")?.body.includes("开通PRO解锁"),
);
assert.ok(
  problems.every((p) => !/买入|换成|卖出|Guéhi|Guehi/.test(`${p.title}${p.body}`)),
  "problems must not name the fix",
);

const copyFacts: TeaserProblemFacts = {
  ...facts,
  flags: flags.map((f) => ({ ...f, status: "a", chance: 100 })),
  pointsOnBenchLast: 0,
};
const copyProblems = buildTeaserProblems(copyFacts);
assert.ok(
  copyProblems.find((p) => p.kind === "club_def")?.body.includes("买谁卖谁"),
);
assert.ok(
  copyProblems.find((p) => p.kind === "ft")?.body.includes("开通PRO后获取更多转会方案"),
);

const line = redactedPlanLine(flags, "zh");
assert.match(line, /中场 × →/);
assert.doesNotMatch(line, /Le Fée|Richards|Guéhi/);

assert.equal(formatOverallRank(3_436_000, "zh"), "343.6万");
assert.equal(parseTeaserEntryId("916934"), 916934);
assert.equal(parseTeaserEntryId("0"), null);
assert.equal(parseTeaserEntryId("abc"), null);

const payload = {
  entryId: 916934,
  problems,
  redactedPlan: line,
  locked: [{ id: "ft", label: "精确 IN → OUT 与转会排序表" }],
};
assert.deepEqual(teaserLeakReasons(payload), []);

assert.ok(
  teaserLeakReasons({ suggestions: [{ in: "Guéhi" }] }).includes(
    "key:suggestions",
  ),
);
assert.ok(teaserLeakReasons({ body: "买入 Haaland" }).length > 0);

for (const locale of ["en", "zh"] as const) {
  const raw = readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8");
  const json = JSON.parse(raw) as { founderPack?: Record<string, string> };
  const fp = json.founderPack;
  assert.ok(fp, `${locale} founderPack`);
  for (const key of [
    "teaserTitle",
    "teaserHint",
    "teaserGenerate",
    "teaserGenerating",
    "teaserCta",
    "teaserLocked",
    "teaserError",
  ]) {
    assert.ok(fp[key], `${locale} founderPack.${key}`);
  }
}

console.log("pro-teaser-self-test ok");
