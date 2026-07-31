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
  getPlApiTeamId,
  preseasonMatchChanged,
  resolvePreseasonMatchFromApi,
} from "@/lib/fpl/preseason-enrich";
import {
  preseasonLineupChanged,
  resolvePreseasonLineupFromApi,
} from "@/lib/fpl/preseason-lineups";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  mergePreseasonGoalLists,
  needsPlScorerBackfill,
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
  lineups_updated: number;
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
    lineup: m.lineup ?? null,
  };
}

function needsLineupFetch(match: PreseasonMatch): boolean {
  return match.status === "finished" && !(match.lineup?.starters?.length);
}

function matchSyncChanged(before: PreseasonMatch, after: PreseasonMatch): boolean {
  return (
    preseasonAppliedChanged(before, after) ||
    preseasonGoalsChanged(before.goals, after.goals) ||
    preseasonLineupChanged(before.lineup, after.lineup)
  );
}

async function resolveMatchUpdates(
  before: PreseasonMatch,
  externalResults: Awaited<ReturnType<typeof fetchAllPreseasonExternalResults>>,
): Promise<{ match: PreseasonMatch; goals_updated: boolean; lineups_updated: boolean }> {
  let next = mergeExternalResultsOntoMatch(before, externalResults);
  let lineups_updated = false;

  if (
    process.env.API_FOOTBALL_KEY?.trim() &&
    (next.status !== "finished" ||
      next.pl_goals == null ||
      next.opp_goals == null ||
      needsPlScorerBackfill(next))
  ) {
    const api = await resolvePreseasonMatchFromApi(next);
    if (api) {
      const mergedGoals =
        api.goals.length > 0
          ? mergePreseasonGoalLists(
              {
                ...next,
                pl_goals: api.pl_goals ?? next.pl_goals,
                opp_goals: api.opp_goals ?? next.opp_goals,
                status: api.status ?? next.status,
              },
              next.goals ?? [],
              api.goals,
            )
          : (next.goals ?? []);
      const apiMerged = {
        kickoff_time: api.kickoff_time ?? next.kickoff_time,
        status: api.status ?? next.status,
        pl_goals: api.pl_goals ?? next.pl_goals,
        opp_goals: api.opp_goals ?? next.opp_goals,
        goals: mergedGoals,
      };
      if (preseasonMatchChanged(next, apiMerged)) {
        next = { ...next, ...apiMerged };
      }
    }
  }

  let goals_updated = false;
  const needsGoals =
    needsPlScorerBackfill(next) || preseasonGoalsHaveInvalidRows(next);
  if (needsGoals) {
    const reportUrls = findReportUrlsForMatch(next, externalResults);
    if (reportUrls.length > 0) {
      const fetched = await fetchGoalsForFinishedMatch(next, reportUrls, {
        skipDiscovery: true,
      });
    const goals =
      fetched.length > 0
        ? mergePreseasonGoalLists(next, next.goals ?? [], fetched)
        : (next.goals ?? []);
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
  }

  if (process.env.API_FOOTBALL_KEY?.trim() && needsLineupFetch(next)) {
    const teamId = getPlApiTeamId(next.pl_code);
    if (teamId) {
      const lineup = await resolvePreseasonLineupFromApi(next, teamId);
      if (lineup && preseasonLineupChanged(next.lineup, lineup)) {
        next = { ...next, lineup };
        lineups_updated = true;
      }
    }
  }

  return { match: next, goals_updated, lineups_updated };
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
  let lineups_updated = 0;
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
      if (resolved.lineups_updated) {
        lineups_updated += 1;
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
    lineups_updated,
    external_results: externalResults.length,
    wrote_file,
  };
}
