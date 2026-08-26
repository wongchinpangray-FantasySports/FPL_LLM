import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP,
  getInsightById,
  listPremiumInsightIds,
} from "../lib/fpl/insights/catalog";
import {
  canAccessInsight,
  canAccessPremiumFeature,
  isInsightsPremiumEnforced,
} from "../lib/fpl/insights/access";
import {
  hasDuplicateFplIds,
  hasDuplicatePlayerIdentity,
} from "../lib/fpl/insights/dedupe";
import { loadPreseasonSignalsRaw } from "../lib/fpl/insights/preseason-signals";
import { loadSetPiecesRaw } from "../lib/fpl/insights/set-pieces";
import { loadDefconLeadersRaw } from "../lib/fpl/insights/defcon";
import { loadTransferMomentumRaw } from "../lib/fpl/insights/transfers";
import { loadDifferentialsRaw } from "../lib/fpl/insights/differentials";
import { loadFixtureSwingRaw } from "../lib/fpl/insights/fixture-swing";
import { loadXgDivergenceRaw } from "../lib/fpl/insights/xg-divergence";
import { loadXaDivergenceRaw } from "../lib/fpl/insights/xa-divergence";
import { loadPriceChangesRaw } from "../lib/fpl/insights/price-changes";
import {
  classifyPriceProgress,
  computePriceProgress,
  loadPriceForecastRaw,
} from "../lib/fpl/insights/price-forecast";
import { isKickoffInWindow } from "../lib/fpl/wechat-matchday";
import { loadXpAccuracyRaw } from "../lib/fpl/insights/xp-accuracy";
import { isStripeConfigured } from "../lib/stripe/server";
import {
  classifyClassicLeague,
  pointsToCatch,
  rankMove,
  squadDiffPct,
  standingsPageForRank,
} from "../lib/fpl/mini-league/math";

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  assert.equal(DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP, 5);
  assert.ok(getInsightById("preseason-signals")?.status === "live");
  assert.ok(listPremiumInsightIds().includes("transfers"));

  if (isInsightsPremiumEnforced()) {
    assert.equal(await canAccessInsight("transfers", null), false);
    assert.equal(await canAccessInsight("set-pieces", null), true);
    assert.equal(await canAccessPremiumFeature(null), false);
  } else {
    assert.equal(await canAccessInsight("transfers", null), true);
    assert.equal(await canAccessPremiumFeature(null), true);
  }

  assert.ok(getInsightById("transfers")?.status === "live");
  assert.ok(getInsightById("differentials")?.status === "live");
  assert.ok(getInsightById("fixture-swing")?.status === "live");
  assert.ok(getInsightById("xg-divergence")?.status === "live");
  assert.ok(getInsightById("xa-divergence")?.status === "live");
  assert.ok(getInsightById("price-changes")?.status === "live");
  assert.ok(getInsightById("price-forecast")?.status === "live");
  assert.ok(getInsightById("price-forecast")?.tier === "free");
  assert.equal(await canAccessInsight("price-forecast", null), true);
  assert.ok(getInsightById("xp-accuracy")?.status === "live");

  assert.deepEqual(rankMove(3, 5), { delta: 2, dir: "up" });
  assert.deepEqual(rankMove(8, 6), { delta: -2, dir: "down" });
  assert.deepEqual(rankMove(4, 4), { delta: 0, dir: "same" });
  assert.equal(rankMove(2, 0).dir, "new");
  assert.equal(pointsToCatch(100, 110), 11);
  assert.equal(pointsToCatch(110, 100), 0);
  assert.equal(classifyClassicLeague({ name: "Office league", league_type: "x" }), "mini");
  assert.equal(classifyClassicLeague({ name: "Overall", league_type: "s" }), "overall");
  assert.equal(squadDiffPct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), 0);
  assert.equal(squadDiffPct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]), 100);
  assert.equal(squadDiffPct([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 18, 19, 20]), 33);
  assert.equal(squadDiffPct([], [1]), null);
  assert.equal(standingsPageForRank(1), 1);
  assert.equal(standingsPageForRank(50), 1);
  assert.equal(standingsPageForRank(51), 2);
  assert.equal(standingsPageForRank(174), 4);

  assert.equal(
    computePriceProgress({
      netTransfers: 100_000,
      selectedByPercent: 10,
      totalPlayers: 10_000_000,
    }),
    1,
  );
  assert.equal(
    computePriceProgress({
      netTransfers: -40_000,
      selectedByPercent: 0.4,
      totalPlayers: 10_000_000,
    }),
    -1,
  );
  assert.equal(classifyPriceProgress(0.9), "likely_rise");
  assert.equal(classifyPriceProgress(-0.6), "watch_fall");
  assert.equal(
    isKickoffInWindow(
      "2026-08-23T14:00:00Z",
      new Date("2026-08-23T10:00:00Z"),
      14,
      30,
    ),
    true,
  );
  assert.equal(
    isKickoffInWindow(
      "2026-08-24T06:00:00Z",
      new Date("2026-08-23T10:00:00Z"),
      14,
      30,
    ),
    false,
  );

  const preseason = await loadPreseasonSignalsRaw();
  assert.ok(preseason.rows.length > 0, "expected preseason signal rows");
  assert.ok(preseason.match_count > 0);
  assert.equal(
    new Set(preseason.rows.map((r) => r.key)).size,
    preseason.rows.length,
    "preseason signals: duplicate row keys",
  );
  assert.equal(
    hasDuplicateFplIds(
      preseason.rows.filter((r) => r.fpl_id != null) as { fpl_id: number }[],
    ),
    false,
    "preseason signals: duplicate fpl_id rows",
  );

  const setPieces = await loadSetPiecesRaw();
  assert.ok(setPieces.teams.length > 0, "expected set-piece teams");
  const setPieceRows = setPieces.teams.flatMap((g) => g.rows);
  assert.equal(
    hasDuplicateFplIds(setPieceRows),
    false,
    "set-pieces: duplicate fpl_id rows",
  );
  assert.equal(
    hasDuplicatePlayerIdentity(setPieceRows),
    false,
    "set-pieces: duplicate player identity rows",
  );

  const defcon = await loadDefconLeadersRaw();
  assert.ok(defcon.rows.length > 0, "expected defcon rows");
  assert.equal(
    hasDuplicateFplIds(defcon.rows),
    false,
    "defcon: duplicate fpl_id rows",
  );
  assert.equal(
    hasDuplicatePlayerIdentity(defcon.rows),
    false,
    "defcon: duplicate player identity rows",
  );

  const transfers = await loadTransferMomentumRaw();
  assert.ok(transfers.rows.length > 0, "expected transfer rows");
  assert.equal(
    hasDuplicateFplIds(transfers.rows),
    false,
    "transfers: duplicate fpl_id rows",
  );
  assert.equal(
    hasDuplicatePlayerIdentity(transfers.rows),
    false,
    "transfers: duplicate player identity rows",
  );

  const differentials = await loadDifferentialsRaw({ limit: 10 });
  assert.ok(differentials.rows.length > 0, "expected differential rows");
  assert.equal(differentials.maxOwnership, 5);
  assert.equal(
    hasDuplicateFplIds(differentials.rows),
    false,
    "differentials: duplicate fpl_id rows",
  );

  const fixtureSwing = await loadFixtureSwingRaw();
  assert.ok(fixtureSwing.rows.length > 0, "expected fixture swing rows");
  assert.ok(fixtureSwing.fromGw >= 1);

  const xgDiv = await loadXgDivergenceRaw();
  assert.ok(xgDiv.rows.length >= 0, "xg divergence load ok");
  if (xgDiv.rows.length > 0) {
    assert.equal(
      hasDuplicateFplIds(xgDiv.rows),
      false,
      "xg-divergence: duplicate fpl_id rows",
    );
    assert.equal(
      hasDuplicatePlayerIdentity(xgDiv.rows),
      false,
      "xg-divergence: duplicate player identity rows",
    );
    for (const pos of ["GKP", "DEF", "MID", "FWD"] as const) {
      assert.ok(
        xgDiv.rows.some((r) => r.position === pos),
        `xg-divergence: expected ${pos} rows`,
      );
    }
  }

  const xaDiv = await loadXaDivergenceRaw();
  assert.ok(xaDiv.rows.length >= 0, "xa divergence load ok");
  if (xaDiv.rows.length > 0) {
    assert.equal(
      hasDuplicateFplIds(xaDiv.rows),
      false,
      "xa-divergence: duplicate fpl_id rows",
    );
    assert.equal(
      hasDuplicatePlayerIdentity(xaDiv.rows),
      false,
      "xa-divergence: duplicate player identity rows",
    );
    for (const pos of ["GKP", "DEF", "MID", "FWD"] as const) {
      assert.ok(
        xaDiv.rows.some((r) => r.position === pos),
        `xa-divergence: expected ${pos} rows`,
      );
    }
  }

  const priceChanges = await loadPriceChangesRaw();
  assert.ok(Array.isArray(priceChanges.rows), "price changes load ok");
  if (priceChanges.rows.length > 0) {
    assert.equal(
      hasDuplicateFplIds(priceChanges.rows),
      false,
      "price-changes: duplicate fpl_id rows",
    );
    assert.equal(
      hasDuplicatePlayerIdentity(priceChanges.rows),
      false,
      "price-changes: duplicate player identity rows",
    );
  }

  const priceForecast = await loadPriceForecastRaw();
  assert.ok(Array.isArray(priceForecast.rows), "price forecast load ok");
  if (priceForecast.rows.length > 0) {
    assert.equal(
      hasDuplicateFplIds(priceForecast.rows),
      false,
      "price-forecast: duplicate fpl_id rows",
    );
    assert.equal(
      hasDuplicatePlayerIdentity(priceForecast.rows),
      false,
      "price-forecast: duplicate player identity rows",
    );
  }

  const xpAccuracy = await loadXpAccuracyRaw();
  assert.ok(Array.isArray(xpAccuracy.gws), "xp accuracy load ok");
  if (xpAccuracy.top_misses.length > 0) {
    assert.equal(
      hasDuplicateFplIds(xpAccuracy.top_misses),
      false,
      "xp-accuracy: duplicate fpl_id in top misses",
    );
  }

  console.log(
    `insights-access-self-test: ok (${preseason.rows.length} preseason, ${transfers.rows.length} transfers, ${differentials.rows.length} diffs, ${fixtureSwing.rows.length} fixture swing, ${xpAccuracy.gws.length} xp-accuracy gws, stripe=${isStripeConfigured()})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
