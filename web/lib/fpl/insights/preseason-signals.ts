import { unstable_cache } from "next/cache";
import {
  getPreseasonBundle,
  type PreseasonMatch,
} from "@/lib/fpl/preseason";
import { loadPreseasonFplPlayerIndex } from "@/lib/fpl/preseason-fpl-players";

export type PreseasonSignalRow = {
  key: string;
  name: string;
  pl_code: string;
  pl_name: string;
  fpl_id: number | null;
  goals: number;
  assists: number;
  starts: number;
  sub_appearances: number;
  matches_involved: number;
};

function playerKey(name: string, plCode: string): string {
  return `${plCode.toUpperCase()}::${name.trim().toLowerCase()}`;
}

function tallyLineup(
  rows: Map<string, PreseasonSignalRow>,
  match: PreseasonMatch,
  players: Array<{ name: string; minute_on?: number | null }>,
  kind: "start" | "sub",
) {
  for (const p of players) {
    const key = playerKey(p.name, match.pl_code);
    const existing = rows.get(key) ?? {
      key,
      name: p.name,
      pl_code: match.pl_code,
      pl_name: match.pl_name,
      fpl_id: null,
      goals: 0,
      assists: 0,
      starts: 0,
      sub_appearances: 0,
      matches_involved: 0,
    };
    if (kind === "start") existing.starts += 1;
    else existing.sub_appearances += 1;
    rows.set(key, existing);
  }
}

export async function loadPreseasonSignalsRaw(): Promise<{
  rows: PreseasonSignalRow[];
  updated_at: string;
  season: string;
  match_count: number;
}> {
  const bundle = getPreseasonBundle();
  const fplIndex = await loadPreseasonFplPlayerIndex();
  const rows = new Map<string, PreseasonSignalRow>();

  for (const match of bundle.matches) {
    if (match.status !== "finished") continue;

    for (const goal of match.goals ?? []) {
      if (!goal.scorer) continue;
      const key = playerKey(goal.scorer, match.pl_code);
      const row = rows.get(key) ?? {
        key,
        name: goal.scorer,
        pl_code: match.pl_code,
        pl_name: match.pl_name,
        fpl_id: null,
        goals: 0,
        assists: 0,
        starts: 0,
        sub_appearances: 0,
        matches_involved: 0,
      };
      row.goals += 1;
      rows.set(key, row);

      if (goal.assist) {
        const aKey = playerKey(goal.assist, match.pl_code);
        const aRow = rows.get(aKey) ?? {
          key: aKey,
          name: goal.assist,
          pl_code: match.pl_code,
          pl_name: match.pl_name,
          fpl_id: null,
          goals: 0,
          assists: 0,
          starts: 0,
          sub_appearances: 0,
          matches_involved: 0,
        };
        aRow.assists += 1;
        rows.set(aKey, aRow);
      }
    }

    if (match.lineup) {
      tallyLineup(rows, match, match.lineup.starters ?? [], "start");
      tallyLineup(rows, match, match.lineup.subs ?? [], "sub");
    }
  }

  for (const row of rows.values()) {
    row.fpl_id = fplIndex.resolveFplId(row.name, row.pl_code);
    row.matches_involved = Math.max(
      row.starts + row.sub_appearances,
      row.goals > 0 || row.assists > 0 ? 1 : 0,
    );
  }

  const sorted = [...rows.values()]
    .filter(
      (r) =>
        r.goals > 0 ||
        r.assists > 0 ||
        r.starts > 0 ||
        r.sub_appearances > 0,
    )
    .sort((a, b) => {
      const scoreA =
        a.goals * 4 + a.assists * 3 + a.starts * 2 + a.sub_appearances;
      const scoreB =
        b.goals * 4 + b.assists * 3 + b.starts * 2 + b.sub_appearances;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    });

  return {
    rows: sorted,
    updated_at: bundle.updated_at,
    season: bundle.season,
    match_count: bundle.matches.filter((m) => m.status === "finished").length,
  };
}

export const loadPreseasonSignals = unstable_cache(
  loadPreseasonSignalsRaw,
  ["fpl-insights-preseason-signals-v1"],
  { revalidate: 300 },
);

export type PreseasonSignalsResult = Awaited<
  ReturnType<typeof loadPreseasonSignalsRaw>
>;
