/**
 * Fail when finished pre-season friendlies (with goals in the scoreline) are
 * missing scorer rows after the grace window — catches sync regressions in CI.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle } from "../lib/fpl/preseason";
import {
  preseasonGoalsComplete,
} from "../lib/fpl/preseason-scorers";

const GRACE_HOURS = 30;

function londonTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function matchAgeHours(date: string, today: string): number {
  const end = new Date(`${date}T23:59:59Z`).getTime();
  const now = new Date(`${today}T12:00:00Z`).getTime();
  return (now - end) / (60 * 60 * 1000);
}

function main(): void {
  const path = join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const today = londonTodayIso();
  const incomplete: Array<{ id: string; label: string; score: string }> = [];

  for (const match of bundle.matches) {
    if (match.status !== "finished") continue;
    if (match.pl_goals == null || match.opp_goals == null) continue;
    if (match.pl_goals + match.opp_goals === 0) continue;
    const goals = match.goals ?? [];
    const plListed = goals.filter((g) => g.side === "pl").length;
    // CI only gates on PL scorers — lower-league opponent names are often unavailable.
    if (plListed >= match.pl_goals) continue;
    if (preseasonGoalsComplete(match)) continue;
    if (matchAgeHours(match.date, today) < GRACE_HOURS) continue;

    incomplete.push({
      id: match.id,
      label: `${match.pl_name} vs ${match.opponent} (${match.date})`,
      score: `${match.pl_goals}-${match.opp_goals}`,
    });
  }

  if (incomplete.length === 0) {
    console.log("Pre-season scorer validation passed.");
    return;
  }

  console.error("Finished friendlies missing scorer details:");
  for (const row of incomplete) {
    console.error(`  - ${row.label} [${row.score}] id=${row.id}`);
  }
  process.exit(1);
}

main();
