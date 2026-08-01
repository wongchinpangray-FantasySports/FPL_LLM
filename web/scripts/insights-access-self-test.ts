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
  isInsightsPremiumEnforced,
} from "../lib/fpl/insights/access";
import { loadPreseasonSignalsRaw } from "../lib/fpl/insights/preseason-signals";
import { loadSetPiecesRaw } from "../lib/fpl/insights/set-pieces";
import { loadDefconLeadersRaw } from "../lib/fpl/insights/defcon";
import { loadTransferMomentumRaw } from "../lib/fpl/insights/transfers";
import { loadDifferentialsRaw } from "../lib/fpl/insights/differentials";
import { loadFixtureSwingRaw } from "../lib/fpl/insights/fixture-swing";
import { loadXgDivergenceRaw } from "../lib/fpl/insights/xg-divergence";
import { loadPriceChangesRaw } from "../lib/fpl/insights/price-changes";

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
  } else {
    assert.equal(await canAccessInsight("transfers", null), true);
  }

  assert.ok(getInsightById("transfers")?.status === "live");
  assert.ok(getInsightById("differentials")?.status === "live");
  assert.ok(getInsightById("fixture-swing")?.status === "live");
  assert.ok(getInsightById("xg-divergence")?.status === "live");
  assert.ok(getInsightById("price-changes")?.status === "live");

  const preseason = await loadPreseasonSignalsRaw();
  assert.ok(preseason.rows.length > 0, "expected preseason signal rows");
  assert.ok(preseason.match_count > 0);

  const setPieces = await loadSetPiecesRaw();
  assert.ok(setPieces.teams.length > 0, "expected set-piece teams");

  const defcon = await loadDefconLeadersRaw();
  assert.ok(defcon.rows.length > 0, "expected defcon rows");

  const transfers = await loadTransferMomentumRaw();
  assert.ok(transfers.rows.length > 0, "expected transfer rows");

  const differentials = await loadDifferentialsRaw({ limit: 10 });
  assert.ok(differentials.rows.length > 0, "expected differential rows");
  assert.equal(differentials.maxOwnership, 5);

  const fixtureSwing = await loadFixtureSwingRaw();
  assert.ok(fixtureSwing.rows.length > 0, "expected fixture swing rows");
  assert.ok(fixtureSwing.fromGw >= 1);

  const xgDiv = await loadXgDivergenceRaw({ limit: 10 });
  assert.ok(xgDiv.rows.length >= 0, "xg divergence load ok");

  const priceChanges = await loadPriceChangesRaw();
  assert.ok(Array.isArray(priceChanges.rows), "price changes load ok");

  console.log(
    `insights-access-self-test: ok (${preseason.rows.length} preseason, ${transfers.rows.length} transfers, ${differentials.rows.length} diffs, ${fixtureSwing.rows.length} fixture swing)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
