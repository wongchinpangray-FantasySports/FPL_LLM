import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle, PreseasonMatch } from "@/lib/fpl/preseason";
import {
  clearPreseasonExternalCache,
  fetchAllPreseasonExternalResults,
  mergeExternalResultsOntoMatch,
  preseasonAppliedChanged,
} from "@/lib/fpl/preseason-sources";
import {
  clearPreseasonFixtureCache,
  preseasonMatchChanged,
  resolvePreseasonMatchFromApi,
} from "@/lib/fpl/preseason-enrich";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  needsPreseasonGoalFetch,
  preseasonGoalsChanged,
} from "@/lib/fpl/preseason-scorers";

export type PreseasonSyncResult = {
  path: string;
  total: number;
  updated: number;
  newly_finished: number;
  goals_updated: number;
  external_results: number;
  wrote_file: boolean;
};

function normalizeMatch(
  m: PreseasonBundle["matches"][number],
): PreseasonMatch {
  return {
    ...m,
    kickoff_time: m.kickoff_time ?? null,
    goals: m.goals ?? [],
  };
}

function matchSyncChanged(before: PreseasonMatch, after: PreseasonMatch): boolean {
  return (
    preseasonAppliedChanged(before, after) ||
    preseasonGoalsChanged(before.goals, after.goals)
  );
}

async function resolveMatchUpdates(
  before: PreseasonMatch,
  externalResults: Awaited<ReturnType<typeof fetchAllPreseasonExternalResults>>,
): Promise<{ match: PreseasonMatch; goals_updated: boolean }> {
  let next = mergeExternalResultsOntoMatch(before, externalResults);

  if (process.env.API_FOOTBALL_KEY?.trim()) {
    const api = await resolvePreseasonMatchFromApi(next);
    if (api && preseasonMatchChanged(next, api)) {
      next = { ...next, ...api };
    }
  }

  let goals_updated = false;
  if (needsPreseasonGoalFetch(next)) {
    const reportUrls = findReportUrlsForMatch(next, externalResults);
    const goals = await fetchGoalsForFinishedMatch(next, reportUrls);
    if (preseasonGoalsChanged(next.goals, goals)) {
      next = { ...next, goals };
      goals_updated = true;
    }
  }

  return { match: next, goals_updated };
}

export async function syncPreseasonResultsJson(
  jsonPath?: string,
): Promise<PreseasonSyncResult> {
  clearPreseasonExternalCache();
  clearPreseasonFixtureCache();

  const path = jsonPath ?? join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;
  const externalResults = await fetchAllPreseasonExternalResults();

  let updated = 0;
  let newly_finished = 0;
  let goals_updated = 0;
  const matches: PreseasonMatch[] = [];

  for (const raw of bundle.matches) {
    const before = normalizeMatch(raw);
    const resolved = await resolveMatchUpdates(before, externalResults);
    const next = resolved.match;

    if (matchSyncChanged(before, next)) {
      updated += 1;
      if (before.status === "scheduled" && next.status === "finished") {
        newly_finished += 1;
      }
      if (resolved.goals_updated) {
        goals_updated += 1;
      }
    }

    matches.push(next);
  }

  const wrote_file = updated > 0;
  if (wrote_file) {
    const next: PreseasonBundle = {
      ...bundle,
      updated_at: new Date().toISOString().slice(0, 10),
      matches,
    };
    writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }

  return {
    path,
    total: bundle.matches.length,
    updated,
    newly_finished,
    goals_updated,
    external_results: externalResults.length,
    wrote_file,
  };
}
