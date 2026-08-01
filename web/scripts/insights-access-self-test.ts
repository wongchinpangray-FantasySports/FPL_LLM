import assert from "node:assert/strict";
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

async function main(): Promise<void> {
  assert.equal(DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP, 5);
  assert.ok(getInsightById("preseason-signals")?.status === "live");
  assert.ok(listPremiumInsightIds().includes("transfers"));

  if (isInsightsPremiumEnforced()) {
    assert.equal(await canAccessInsight("transfers", null), false);
    assert.equal(await canAccessInsight("set-pieces", null), true);
  } else {
    assert.equal(await canAccessInsight("transfers", null), true);
  }

  const preseason = await loadPreseasonSignalsRaw();
  assert.ok(preseason.rows.length > 0, "expected preseason signal rows");
  assert.ok(preseason.match_count > 0);

  console.log(
    `insights-access-self-test: ok (${preseason.rows.length} preseason rows, premium enforce=${isInsightsPremiumEnforced()})`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
