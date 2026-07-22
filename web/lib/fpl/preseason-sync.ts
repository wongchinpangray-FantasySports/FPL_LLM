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

export type PreseasonSyncResult = {
  path: string;
  total: number;
  updated: number;
  newly_finished: number;
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

async function resolveMatchUpdates(
  before: PreseasonMatch,
  externalResults: Awaited<ReturnType<typeof fetchAllPreseasonExternalResults>>,
): Promise<PreseasonMatch> {
  let next = mergeExternalResultsOntoMatch(before, externalResults);

  if (process.env.API_FOOTBALL_KEY?.trim()) {
    const api = await resolvePreseasonMatchFromApi(next);
    if (api && preseasonMatchChanged(next, api)) {
      next = { ...next, ...api };
    }
  }

  return next;
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
  const matches: PreseasonMatch[] = [];

  for (const raw of bundle.matches) {
    const before = normalizeMatch(raw);
    const next = await resolveMatchUpdates(before, externalResults);

    if (preseasonAppliedChanged(before, next)) {
      updated += 1;
      if (before.status === "scheduled" && next.status === "finished") {
        newly_finished += 1;
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
    external_results: externalResults.length,
    wrote_file,
  };
}
