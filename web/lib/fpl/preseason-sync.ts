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
import { fetchLineupForFinishedMatch } from "@/lib/fpl/preseason-report-lineups";
import {
  fetchGoalsForFinishedMatch,
  findReportUrlsForMatch,
  mergePreseasonGoalLists,
  needsPlScorerBackfill,
  preseasonGoalsChanged,
  preseasonGoalsComplete,
} from "@/lib/fpl/preseason-scorers";
import {
  isPlausiblePreseasonScorerName,
  preseasonGoalsHaveInvalidRows,
} from "@/lib/fpl/preseason-report-goals";

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

/** Only run slow web discovery for matches within this many days. */
const ENRICH_RECENT_DAYS = 4;
/** Cap expensive Google/DDG discovery calls per sync run (prevents hang). */
const MAX_WEB_DISCOVERIES_PER_RUN = 8;

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
  if (match.status !== "finished") return false;
  const starters = match.lineup?.starters?.length ?? 0;
  return starters === 0 || starters < 11;
}

function daysSinceMatch(date: string, asOf = new Date()): number {
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(ms)) return 99;
  return Math.floor((asOf.getTime() - ms) / 86_400_000);
}

function isRecentEnoughForEnrichment(match: PreseasonMatch): boolean {
  return daysSinceMatch(match.date) <= ENRICH_RECENT_DAYS;
}

function matchSyncChanged(before: PreseasonMatch, after: PreseasonMatch): boolean {
  return (
    preseasonAppliedChanged(before, after) ||
    preseasonGoalsChanged(before.goals, after.goals) ||
    preseasonLineupChanged(before.lineup, after.lineup)
  );
}

type EnrichBudget = { discoveriesLeft: number };

async function resolveMatchUpdates(
  before: PreseasonMatch,
  externalResults: Awaited<ReturnType<typeof fetchAllPreseasonExternalResults>>,
  budget: EnrichBudget,
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
  // Always drop junk scorers (club names / parse fragments), even without enrichment.
  if (preseasonGoalsHaveInvalidRows(next)) {
    const cleaned = (next.goals ?? []).filter((g) =>
      isPlausiblePreseasonScorerName(g.scorer, next),
    );
    if (preseasonGoalsChanged(next.goals, cleaned)) {
      next = { ...next, goals: cleaned };
      goals_updated = true;
    }
  }

  const needsGoals =
    next.status === "finished" &&
    (needsPlScorerBackfill(next) || !preseasonGoalsComplete(next));
  const enrichRecent = isRecentEnoughForEnrichment(next);

  if (needsGoals && enrichRecent) {
    const reportUrls = findReportUrlsForMatch(next, externalResults);
    const allowDiscovery =
      reportUrls.length === 0 && budget.discoveriesLeft > 0;
    if (allowDiscovery) budget.discoveriesLeft -= 1;

    if (reportUrls.length > 0 || allowDiscovery) {
      const fetched = await fetchGoalsForFinishedMatch(next, reportUrls, {
        skipDiscovery: !allowDiscovery,
      });
      const goals =
        fetched.length > 0
          ? mergePreseasonGoalLists(next, next.goals ?? [], fetched)
          : (next.goals ?? []);
      if (
        goals.length === 0 &&
        (next.goals ?? []).length > 0 &&
        preseasonGoalsComplete(next)
      ) {
        // Keep existing scorers when enrichment finds nothing new.
      } else if (
        preseasonGoalsChanged(next.goals, goals) ||
        (!preseasonGoalsComplete(next) &&
          preseasonGoalsComplete({ ...next, goals }))
      ) {
        next = { ...next, goals };
        goals_updated = true;
      }
    }
  }

  // Lineups: known report URLs always; web discovery only for recent + budget.
  if (needsLineupFetch(next) && enrichRecent) {
    const teamId = getPlApiTeamId(next.pl_code);
    if (process.env.API_FOOTBALL_KEY?.trim() && teamId) {
      const lineup = await resolvePreseasonLineupFromApi(next, teamId);
      if (lineup && preseasonLineupChanged(next.lineup, lineup)) {
        next = { ...next, lineup };
        lineups_updated = true;
      }
    }

    if (needsLineupFetch(next)) {
      const reportUrls = findReportUrlsForMatch(next, externalResults);
      const reportLineup = await fetchLineupForFinishedMatch(next, reportUrls, {
        skipDiscovery: true,
      });
      if (reportLineup && preseasonLineupChanged(next.lineup, reportLineup)) {
        next = { ...next, lineup: reportLineup };
        lineups_updated = true;
      } else if (
        needsLineupFetch(next) &&
        budget.discoveriesLeft > 0 &&
        // Prefer scorer discovery while scores are still incomplete.
        preseasonGoalsComplete(next)
      ) {
        budget.discoveriesLeft -= 1;
        const discoveredLineup = await fetchLineupForFinishedMatch(
          next,
          reportUrls,
          { skipDiscovery: false },
        );
        if (
          discoveredLineup &&
          preseasonLineupChanged(next.lineup, discoveredLineup)
        ) {
          next = { ...next, lineup: discoveredLineup };
          lineups_updated = true;
        }
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
  console.log(
    `Pre-season sync: loading external results for ${bundle.matches.length} matches…`,
  );
  const externalResults = await fetchAllPreseasonExternalResults();
  console.log(`Pre-season sync: ${externalResults.length} external results.`);

  let updated = 0;
  let newly_finished = 0;
  let goals_updated = 0;
  let lineups_updated = 0;
  const matches: PreseasonMatch[] = [];
  const budget: EnrichBudget = {
    discoveriesLeft: MAX_WEB_DISCOVERIES_PER_RUN,
  };

  // Prefer enriching the newest fixtures first so today's scores/scorers win the budget.
  const indexed = bundle.matches.map((raw, index) => ({ raw, index }));
  indexed.sort((a, b) => {
    const byDate = b.raw.date.localeCompare(a.raw.date);
    if (byDate !== 0) return byDate;
    return a.index - b.index;
  });

  const resolvedByIndex = new Array<PreseasonMatch>(bundle.matches.length);

  for (const { raw, index } of indexed) {
    const before = normalizeMatch(raw);
    const resolved = await resolveMatchUpdates(
      before,
      externalResults,
      budget,
    );
    const next = resolved.match;
    resolvedByIndex[index] = next;

    if (matchSyncChanged(before, next)) {
      updated += 1;
      if (before.status === "scheduled" && next.status === "finished") {
        newly_finished += 1;
        console.log(
          `Finished: ${next.date} ${next.pl_code} ${next.pl_goals}-${next.opp_goals} ${next.opponent}`,
        );
      }
      if (resolved.goals_updated) {
        goals_updated += 1;
      }
      if (resolved.lineups_updated) {
        lineups_updated += 1;
      }
    }
  }

  for (const m of resolvedByIndex) {
    matches.push(m!);
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

  console.log(
    `Pre-season sync done. discoveries_left=${budget.discoveriesLeft}`,
  );

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
