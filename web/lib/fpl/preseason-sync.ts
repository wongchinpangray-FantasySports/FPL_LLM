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
  preseasonGoalsComplete,
} from "@/lib/fpl/preseason-scorers";
import { preseasonGoalsHaveInvalidRows } from "@/lib/fpl/preseason-report-goals";

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
  if (needsPreseasonGoalFetch(next) || preseasonGoalsHaveInvalidRows(next)) {
    const reportUrls = findReportUrlsForMatch(next, externalResults);
    const goals = await fetchGoalsForFinishedMatch(next, reportUrls);
    if (
      goals.length === 0 &&
      (next.goals ?? []).length > 0 &&
      !preseasonGoalsHaveInvalidRows(next)
    ) {
      // Keep existing scorers when enrichment finds nothing new.
    } else if (
      preseasonGoalsChanged(next.goals, goals) ||
      (!preseasonGoalsComplete(next) && preseasonGoalsComplete({ ...next, goals })) ||
      (preseasonGoalsHaveInvalidRows(next) && !preseasonGoalsHaveInvalidRows({ ...next, goals }))
    ) {
      next = { ...next, goals };
      goals_updated = true;
    }
  }

  return { match: next, goals_updated };
}

function addLondonDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function retryIncompleteGoalDetails(
  matches: PreseasonMatch[],
  externalResults: Awaited<ReturnType<typeof fetchAllPreseasonExternalResults>>,
  today: string,
): Promise<{ matches: PreseasonMatch[]; goals_updated: number; updated: number }> {
  const cutoff = addLondonDays(today, -14);
  let goals_updated = 0;
  let updated = 0;
  const nextMatches = [...matches];

  clearPreseasonFixtureCache();

  for (let i = 0; i < nextMatches.length; i += 1) {
    const current = nextMatches[i];
    if (current.status !== "finished") continue;
    if (current.date < cutoff) continue;
    if (
      !needsPreseasonGoalFetch(current) &&
      !preseasonGoalsHaveInvalidRows(current)
    ) {
      continue;
    }

    const before = current;
    const resolved = await resolveMatchUpdates(before, externalResults);
    nextMatches[i] = resolved.match;

    if (matchSyncChanged(before, resolved.match)) {
      updated += 1;
      if (resolved.goals_updated) goals_updated += 1;
    }
  }

  return { matches: nextMatches, goals_updated, updated };
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
  let matches: PreseasonMatch[] = [];

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

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const retry = await retryIncompleteGoalDetails(matches, externalResults, today);
  if (retry.updated > 0) {
    matches = retry.matches;
    updated += retry.updated;
    goals_updated += retry.goals_updated;
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
