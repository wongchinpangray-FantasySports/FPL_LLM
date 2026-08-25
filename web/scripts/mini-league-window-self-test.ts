/**
 * Regression tests for huge-league 10-above / 10-below sampling.
 *
 *   cd web && npx tsx scripts/mini-league-window-self-test.ts
 */
import assert from "node:assert/strict";
import {
  chipSlotsFromUsed,
  classifyChipName,
  neighborStandingsPages,
  nextStandingsScanPages,
  overlayChipSlots,
  pickRivalSample,
  publishedPicksGw,
  fixtureWindowStart,
  resolveYourStandingsPage,
  shouldContinueStandingsScan,
  standingsPageForRank,
} from "../lib/fpl/mini-league/math";

function row(entry: number, rank: number) {
  return { entry, rank };
}

function main(): void {
  assert.equal(standingsPageForRank(1560), 32);

  assert.deepEqual(nextStandingsScanPages([1, 31, 32], 32), [33, 34, 35, 36]);
  assert.deepEqual(nextStandingsScanPages([1, 31, 32, 33, 34, 35, 36], 32), [
    37, 38, 39, 40,
  ]);
  assert.deepEqual(
    nextStandingsScanPages([1], 32),
    [32, 33, 34, 35],
    "if the hint page failed to load, retry from the hint, not from page 2",
  );

  assert.equal(
    shouldContinueStandingsScan({
      found: false,
      scanned: 4,
      frontierLoaded: true,
      frontierHasNext: true,
      lastRank: 1560,
      youRank: 1560,
    }),
    true,
    "keep scanning while the last row is still the tied rank",
  );
  assert.equal(
    shouldContinueStandingsScan({
      found: false,
      scanned: 4,
      frontierLoaded: true,
      frontierHasNext: true,
      lastRank: 1661,
      youRank: 1560,
    }),
    false,
    "stop once standings have passed your rank",
  );
  assert.equal(
    shouldContinueStandingsScan({
      found: true,
      scanned: 0,
      frontierLoaded: true,
      frontierHasNext: true,
      lastRank: 1560,
      youRank: 1560,
    }),
    false,
  );

  assert.deepEqual(neighborStandingsPages(38, 21, 50), [38]);
  assert.deepEqual(neighborStandingsPages(38, 2, 50), [37, 38]);
  assert.deepEqual(neighborStandingsPages(38, 45, 50), [38, 39]);

  const you = 56657;
  const wrongPage = Array.from({ length: 50 }, (_, i) => row(1000 + i, i < 20 ? 1264 : 1560));
  assert.deepEqual(
    pickRivalSample(wrongPage, you),
    [],
    "must not fall back to the top of a page that does not contain you",
  );
  assert.deepEqual(pickRivalSample(wrongPage.slice(0, 10), you), []);

  const around = [
    ...Array.from({ length: 50 }, (_, i) => row(2000 + i, 1560)),
    ...Array.from({ length: 21 }, (_, i) => row(i === 10 ? you : 3000 + i, 1560)),
    ...Array.from({ length: 29 }, (_, i) => row(4000 + i, 1560)),
  ];
  const sample = pickRivalSample(around, you);
  assert.equal(sample.length, 21);
  assert.equal(sample[10]?.entry, you);
  assert.equal(sample[0]?.entry, 3000);
  assert.equal(sample[9]?.entry, 3009);
  assert.equal(sample[11]?.entry, 3011);
  assert.equal(
    sample.some((row) => row.entry === 1000),
    false,
    "1.2k-band managers must not appear in the 1.5k window",
  );

  const small = [row(1, 1), row(you, 2), row(3, 3)];
  assert.deepEqual(
    pickRivalSample(small, you).map((r) => r.entry),
    [1, you, 3],
  );

  assert.equal(resolveYourStandingsPage(38, 1560), 38);
  assert.equal(resolveYourStandingsPage(null, 1560), 32);

  assert.equal(classifyChipName("bboost"), "bboost");
  assert.equal(classifyChipName("bb"), "bboost");
  const bbGw1 = chipSlotsFromUsed([{ name: "bboost", event: 1 }]);
  assert.equal(bbGw1.bb1.used, true);
  assert.equal(bbGw1.bb1.event, 1);
  assert.equal(bbGw1.bb2.used, false);
  const fromPicks = overlayChipSlots(
    chipSlotsFromUsed([]),
    chipSlotsFromUsed([{ name: "bboost", event: 1 }]),
  );
  assert.equal(fromPicks.bb1.used, true);

  assert.equal(
    publishedPicksGw({ current: 1, next: 2, currentFinished: true, nextIsCurrent: false }),
    1,
    "GW1 finished / GW2 not started: use GW1 picks, not the 404 next GW",
  );
  assert.equal(
    publishedPicksGw({ current: 2, next: 3, currentFinished: false, nextIsCurrent: false }),
    2,
  );
  assert.equal(
    publishedPicksGw({ current: 1, next: 2, currentFinished: true, nextIsCurrent: true }),
    2,
  );
  assert.equal(
    fixtureWindowStart({ current: 1, next: 2, currentFinished: true }),
    2,
    "fixture overlap starts at the upcoming GW after a finished GW1",
  );
  assert.equal(fixtureWindowStart({ current: 2, next: 3, currentFinished: false }), 2);

  console.log("mini-league-window-self-test: ok");
}

main();
