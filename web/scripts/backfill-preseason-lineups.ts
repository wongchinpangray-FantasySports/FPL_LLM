/**
 * Backfill PL lineups for finished friendlies from club match reports.
 * Usage: npx tsx scripts/backfill-preseason-lineups.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle, PreseasonMatch } from "../lib/fpl/preseason";
import { fetchLineupForFinishedMatch } from "../lib/fpl/preseason-report-lineups";
import { preseasonLineupChanged } from "../lib/fpl/preseason-lineups";
import { findReportUrlsForMatch } from "../lib/fpl/preseason-scorers";

function needsLineupBackfill(match: PreseasonMatch): boolean {
  if (match.status !== "finished") return false;
  const starters = match.lineup?.starters?.length ?? 0;
  return starters === 0 || starters < 11;
}

async function main(): Promise<void> {
  const path = join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const matches: PreseasonMatch[] = bundle.matches.map((m) => ({
    ...m,
    kickoff_time: m.kickoff_time ?? null,
    goals: m.goals ?? [],
    lineup: m.lineup ?? null,
  }));

  let lineups_updated = 0;
  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    if (!needsLineupBackfill(m)) continue;

    const reportUrls = findReportUrlsForMatch(m, []);
    console.log(
      `Lineup ${m.id} — ${m.pl_name} vs ${m.opponent}, ${reportUrls.length} known URLs`,
    );

    let lineup =
      (await fetchLineupForFinishedMatch(m, reportUrls, {
        skipDiscovery: reportUrls.length > 0,
      })) ??
      (await fetchLineupForFinishedMatch(m, reportUrls, {
        skipDiscovery: false,
      }));

    if (lineup && preseasonLineupChanged(m.lineup, lineup)) {
      matches[i] = { ...m, lineup };
      lineups_updated += 1;
      console.log(
        `  ok: ${lineup.starters.length} starters, ${lineup.subs.length} subs`,
      );
    } else {
      console.log("  no lineup found");
    }
  }

  if (lineups_updated > 0) {
    const next: PreseasonBundle = {
      ...bundle,
      updated_at: new Date().toISOString().slice(0, 10),
      matches,
    };
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  console.log(
    `Backfill complete: ${lineups_updated} lineups updated, ${matches.filter((m) => m.lineup?.starters?.length).length}/${matches.filter((m) => m.status === "finished").length} finished with lineups`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
