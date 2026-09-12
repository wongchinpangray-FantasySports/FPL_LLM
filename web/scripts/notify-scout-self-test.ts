import assert from "node:assert/strict";
import {
  buildScoutReleaseCopy,
  parseScoutReleaseBody,
  profileNotifyLocale,
  scoutReleaseDisplayTitle,
  scoutReleaseHref,
  scoutReleaseTitleOf,
  shanghaiDateIso,
  shanghaiDatesInPushedWindow,
  shanghaiDayUtcRange,
  type ScoutReleaseArticle,
} from "../lib/notifications/scout-release";

function sample(partial: Partial<ScoutReleaseArticle>): ScoutReleaseArticle {
  return {
    slug: "demo-slug",
    title_en: "Who has the best fixtures?",
    title_zh: "从 FPL 第四轮起，谁的赛程最好？",
    excerpt_en: "A fixtures frisk.",
    excerpt_zh: "例行赛程体检。",
    pushed_at: "2026-09-11T09:52:16.380Z",
    ...partial,
  };
}

function main(): void {
  assert.equal(shanghaiDateIso(new Date("2026-09-11T09:52:00.000Z")), "2026-09-11");
  assert.equal(shanghaiDateIso(new Date("2026-09-10T16:00:00.000Z")), "2026-09-11");
  assert.equal(shanghaiDateIso(new Date("2026-09-10T15:59:00.000Z")), "2026-09-10");

  const range = shanghaiDayUtcRange("2026-09-11");
  assert.equal(range.startIso, "2026-09-10T16:00:00.000Z");
  assert.equal(range.endIso, "2026-09-11T16:00:00.000Z");
  assert.equal(scoutReleaseHref("2026-09-11"), "/scout?released=2026-09-11");
  assert.equal(profileNotifyLocale("en-GB"), "en");
  assert.equal(profileNotifyLocale("zh"), "zh");
  assert.equal(profileNotifyLocale(null), "zh");

  const one = buildScoutReleaseCopy([sample({})], "zh", "2026-09-11");
  assert.match(one.title, /Scout 中文上新/);
  assert.match(one.title, /谁的赛程最好/);
  assert.equal(one.href, "/scout?released=2026-09-11");
  assert.match(one.body, /赛程体检/);

  const many = [
    sample({ slug: "a", title_zh: "进球预期" }),
    sample({ slug: "b", title_zh: "零封赔率" }),
    sample({ slug: "c", title_zh: "Scout Squad：第四轮首选" }),
  ];
  const digest = buildScoutReleaseCopy(many, "zh", "2026-09-11");
  assert.equal(digest.title, "Scout 中文上新 · 3 篇");
  assert.match(digest.body, /· 进球预期/);
  assert.match(digest.body, /· 零封赔率/);
  assert.match(digest.body, /Fantasy Football Scout/);
  assert.doesNotMatch(digest.body, /Insights Pro|¥|创始人/);

  const en = buildScoutReleaseCopy(many, "en", "2026-09-11");
  assert.equal(en.title, "3 new Scout articles");
  assert.match(en.body, /free to read/);

  const parsedDigest = parseScoutReleaseBody(digest.body);
  assert.deepEqual(parsedDigest.titles, ["进球预期", "零封赔率", "Scout Squad：第四轮首选"]);
  assert.equal(parsedDigest.extra, 0);
  assert.match(parsedDigest.footer ?? "", /Fantasy Football Scout/);

  const jammed = parseScoutReleaseBody(
    "进球预期 零封赔率 +6 more From Fantasy Football Scout — free to read on Faleague.",
  );
  assert.equal(jammed.extra, 6);
  assert.equal(scoutReleaseDisplayTitle("14 new Scout articles", 14), "Scout 中文上新 · 14 篇");
  assert.match(scoutReleaseDisplayTitle("New Scout article: Who has the best fixtures?", 1), /Scout 中文上新/);

  assert.equal(
    scoutReleaseTitleOf(sample({ title_zh: "Who has the best fixtures?" })),
    "Who has the best fixtures?",
  );

  assert.deepEqual(
    shanghaiDatesInPushedWindow([
      sample({ pushed_at: "2026-09-11T09:52:00.000Z" }),
      sample({ pushed_at: "2026-09-10T00:52:00.000Z" }),
      sample({ pushed_at: null }),
    ]),
    ["2026-09-10", "2026-09-11"],
  );

  console.log("notify-scout-self-test: ok");
}

main();
