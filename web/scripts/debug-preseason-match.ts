/**
 * Debug scorer enrichment for one pre-season match.
 * Usage: npx tsx scripts/debug-preseason-match.ts mun-2026-07-24-42
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle } from "../lib/fpl/preseason";
import { resolvePreseasonMatchFromApi } from "../lib/fpl/preseason-enrich";
import { fetchGoalsForFinishedMatch } from "../lib/fpl/preseason-scorers";
import { discoverWebMatchReportUrls } from "../lib/fpl/preseason-report-goals";

const id = process.argv[2] ?? "mun-2026-07-24-42";
const path = join(process.cwd(), "data/epl-preseason-2627.json");
const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
const match = bundle.matches.find((m) => m.id === id);

if (!match) {
  console.error(`Match not found: ${id}`);
  process.exit(1);
}

const resolved = match;

async function main(): Promise<void> {
  console.log("Match:", resolved.pl_name, "vs", resolved.opponent, resolved.date);
  console.log("Score:", resolved.pl_goals, "-", resolved.opp_goals);
  console.log("API_FOOTBALL_KEY set:", Boolean(process.env.API_FOOTBALL_KEY?.trim()));

  const urls = await discoverWebMatchReportUrls(resolved);
  console.log("Discovered URLs:", urls.length);
  for (const url of urls.slice(0, 8)) console.log(" ", url);

  if (process.env.API_FOOTBALL_KEY?.trim()) {
    const api = await resolvePreseasonMatchFromApi(resolved);
    console.log("API result:", api ? `${api.goals.length} goals` : "null");
    if (api?.goals.length) console.log(JSON.stringify(api.goals, null, 2));
  }

  const goals = await fetchGoalsForFinishedMatch(resolved, urls);
  console.log("fetchGoalsForFinishedMatch:", goals.length, "goals");
  if (goals.length) console.log(JSON.stringify(goals, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
