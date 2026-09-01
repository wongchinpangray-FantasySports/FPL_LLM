/**
 * Lightweight self-test for transfer diagnose pairing helpers.
 * Run: npx tsx scripts/transfers-diagnose-self-test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function clubOk(
  outTeam: number | null,
  inTeam: number | null,
  clubCount: Map<number, number>,
): boolean {
  if (inTeam == null) return true;
  const after =
    (clubCount.get(inTeam) ?? 0) + 1 - (outTeam === inTeam ? 1 : 0);
  return after <= 3;
}

function affordable(
  outPrice: number,
  inPrice: number,
  bank: number,
): boolean {
  return inPrice <= outPrice + bank;
}

function hitCost(ft: number): number {
  return ft >= 1 ? 0 : 4;
}

// Club cap
{
  const clubs = new Map([
    [1, 3],
    [2, 1],
  ]);
  assert.equal(clubOk(3, 1, clubs), false, "cannot add 4th from club 1");
  assert.equal(clubOk(1, 1, clubs), true, "swap within same club ok");
  assert.equal(clubOk(1, 2, clubs), true, "free a slot then add club 2");
}

// Budget
{
  assert.equal(affordable(6.5, 7.0, 0.5), true);
  assert.equal(affordable(6.5, 7.1, 0.5), false);
  assert.equal(affordable(5.0, 4.5, 0), true);
}

// FT / hit
{
  assert.equal(hitCost(1), 0);
  assert.equal(hitCost(2), 0);
  assert.equal(hitCost(0), 4);
  assert.equal(10.5 - hitCost(0), 6.5);
}

// i18n keys present
{
  for (const locale of ["en", "zh"] as const) {
    const raw = readFileSync(
      join(process.cwd(), "messages", `${locale}.json`),
      "utf8",
    );
    const json = JSON.parse(raw) as Record<string, unknown>;
    assert.ok(json.transfers, `${locale} transfers namespace`);
    assert.ok(json.transfersIndex, `${locale} transfersIndex namespace`);
    const t = json.transfers as Record<string, string>;
    for (const key of [
      "title",
      "kind_injured",
      "kind_low_xp",
      "kind_low_form",
      "hitCost",
      "suggestionsTitle",
      "applyInPlanner",
      "fhSuggestNote",
      "expandPanel",
      "pitchMarkersHint",
      "pitchLegendAlert",
    ]) {
      assert.ok(t[key], `${locale}.transfers.${key}`);
    }
    const pa = json.plannerApp as Record<string, string>;
    assert.ok(pa.errSuggestOutMissing, `${locale}.plannerApp.errSuggestOutMissing`);
  }
}

console.log("transfers-diagnose-self-test: ok");
