/**
 * Leak-safe teaser helpers (no FPL / DB).
 * Run: npx tsx scripts/pro-teaser-self-test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPreviewProTeaser,
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
  overallRank: 1_640_000,
  lastGw: 6,
  lastGwPoints: 48,
  prevOverallRank: 1_520_000,
  nextGw: 7,
  league: { name: "AI League", rank: 16, gap: 63 },
  freeTransfers: 1,
  flags,
};

const preview = buildPreviewProTeaser("zh");
assert.equal(preview.problems.length, 3);
assert.deepEqual(
  preview.problems.map((p) => p.kind),
  ["overall", "league", "transfer"],
);
assert.ok(preview.problems[0]?.body.includes("绿箭头"));
assert.ok(preview.problems[1]?.body.includes("周冠军"));
assert.ok(preview.problems[2]?.body.includes("免费转会"));
assert.ok(preview.problems[2]?.body.includes("卖走 E.Le Fée"));
assert.ok(preview.problems[2]?.body.includes("买进 XXX"));
assert.deepEqual(teaserLeakReasons(preview), []);

const problems = buildTeaserProblems(facts);
assert.equal(problems.length, 3);
assert.equal(problems[0]?.kind, "overall");
assert.equal(problems[1]?.kind, "league");
assert.equal(problems[2]?.kind, "transfer");
assert.ok(problems[1]?.body.includes("第 16"));
assert.ok(
  problems.every((p) => !/买入|换成|卖出|Guéhi|Guehi/.test(`${p.title}${p.body}`)),
  "problems must not name the fix",
);

const copyFacts: TeaserProblemFacts = {
  ...facts,
  league: null,
  prevOverallRank: 1_800_000,
};
const copyProblems = buildTeaserProblems(copyFacts);
assert.ok(copyProblems[0]?.body.includes("升了"));
assert.ok(copyProblems[1]?.body.includes("没有读到私人小联赛"));

const line = redactedPlanLine(flags, "zh");
assert.match(line, /卖走 E\.Le Fée 买进 XXX/);
assert.doesNotMatch(line, /Guéhi|Guehi|买入|卖出|换成/);

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
