/**
 * Backfill scorer rows for finished friendlies missing PL scorer details.
 * Usage: npx tsx scripts/backfill-preseason-goals.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle, PreseasonMatch } from "../lib/fpl/preseason";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  needsPlScorerBackfill,
  preseasonGoalsChanged,
} from "../lib/fpl/preseason-scorers";

async function main(): Promise<void> {
  const path = join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const matches: PreseasonMatch[] = bundle.matches.map((m) => ({
    ...m,
    kickoff_time: m.kickoff_time ?? null,
    goals: m.goals ?? [],
  }));

  let goals_updated = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    if (!needsPlScorerBackfill(m)) continue;

    const reportUrls = findReportUrlsForMatch(m, []);
    console.log(
      `Backfill ${m.id} — ${m.pl_name} vs ${m.opponent} (${m.pl_goals}-${m.opp_goals}), ${reportUrls.length} URLs`,
    );
    const goals = await fetchGoalsForFinishedMatch(m, reportUrls, {
      skipDiscovery: reportUrls.length > 0,
    });
    if (goals.length > 0 && preseasonGoalsChanged(m.goals, goals)) {
      matches[i] = { ...m, goals };
      goals_updated += 1;
      console.log(
        `  ok: ${goals.filter((g) => g.side === "pl").length} PL / ${goals.filter((g) => g.side === "opp").length} opp`,
      );
    } else {
      console.log("  skip: no new goals");
    }
  }

  if (goals_updated === 0) {
    console.log("No scorer updates written.");
    return;
  }

  const next: PreseasonBundle = {
    ...bundle,
    updated_at: new Date().toISOString().slice(0, 10),
    matches,
  };
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Wrote ${goals_updated} match(es) to ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
