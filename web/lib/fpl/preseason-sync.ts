import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PreseasonBundle, PreseasonMatch } from "@/lib/fpl/preseason";
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

export async function syncPreseasonResultsJson(
  jsonPath?: string,
): Promise<PreseasonSyncResult> {
  clearPreseasonFixtureCache();

  const path = jsonPath ?? join(process.cwd(), "data/epl-preseason-2627.json");
  const bundle = JSON.parse(readFileSync(path, "utf8")) as PreseasonBundle;

  let updated = 0;
  let newly_finished = 0;
  const matches: PreseasonMatch[] = [];

  for (const raw of bundle.matches) {
    const before = normalizeMatch(raw);
    const resolved = await resolvePreseasonMatchFromApi(before);
    if (!resolved || !preseasonMatchChanged(before, resolved)) {
      matches.push(before);
      continue;
    }

    updated += 1;
    if (before.status === "scheduled" && resolved.status === "finished") {
      newly_finished += 1;
    }

    matches.push({ ...before, ...resolved });
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
    wrote_file,
  };
}
