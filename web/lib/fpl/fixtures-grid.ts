import { buildFplFdrLookup, buildH2HStore, lookupFplFdr } from "@/lib/fpl/fdr";
import {
  getEpl2627Fixtures,
  getEpl2627Season,
  getEpl2627Teams,
} from "@/lib/fpl/epl-2627";
import { FPL_LAST_SEASON_GW } from "@/lib/dashboard";

export type FplFdrCell = {
  fixture_id: number;
  gw: number;
  opp: string;
  opp_name: string;
  home: boolean;
  fdr: number;
};

export type FplFdrRow = {
  team_id: number;
  short: string;
  name: string;
  fixtures: FplFdrCell[];
};

export type FplGwBlock = {
  fromGw: number;
  toGw: number;
  label: string;
};

export type FplFixtureGrid = {
  startGw: number;
  endGw: number;
  gwHeaders: number[];
  gwBlocks: FplGwBlock[];
  rows: FplFdrRow[];
  dgwKeys: string[];
  fplSeason: string;
};

export const FPL_GW_BLOCK_RANGES: [number, number][] = [
  [1, 6],
  [7, 12],
  [13, 18],
  [19, 24],
  [25, 30],
  [31, 38],
];

function buildGwBlocks(): FplGwBlock[] {
  return FPL_GW_BLOCK_RANGES.map(([fromGw, toGw]) => ({
    fromGw,
    toGw,
    label: `GW${fromGw}–${toGw}`,
  }));
}

function buildDoubleGameweekKeys(
  fixtures: { gw: number; home_team_id: number; away_team_id: number }[],
  teamIds: number[],
  fromGw: number,
  toGw: number,
): string[] {
  const want = new Set(teamIds);
  const counts = new Map<string, number>();

  for (const fx of fixtures) {
    if (fx.gw < fromGw || fx.gw > toGw) continue;
    for (const tid of [fx.home_team_id, fx.away_team_id]) {
      if (!want.has(tid)) continue;
      const key = `${tid}:${fx.gw}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].filter(([, n]) => n >= 2).map(([k]) => k);
}

export async function buildFplFixtureGrid(): Promise<FplFixtureGrid> {
  const season = getEpl2627Season();
  const teams = getEpl2627Teams();
  const fixtures = getEpl2627Fixtures();
  const startGw = 1;
  const endGw = FPL_LAST_SEASON_GW;
  const fplSeason = season.season;

  const teamIds = [...teams.keys()].sort((a, b) =>
    (teams.get(a)?.short ?? "").localeCompare(teams.get(b)?.short ?? ""),
  );

  const h2hStore = await buildH2HStore();
  const fdrLookup = buildFplFdrLookup(
    fixtures.map((f) => ({
      id: f.id,
      home: teams.get(f.home_team_id)!.code,
      away: teams.get(f.away_team_id)!.code,
    })),
    h2hStore,
  );

  const dgwKeys = buildDoubleGameweekKeys(fixtures, teamIds, startGw, endGw);
  const gwHeaders = Array.from(
    { length: endGw - startGw + 1 },
    (_, i) => startGw + i,
  );

  const rows: FplFdrRow[] = [];
  for (const teamId of teamIds) {
    const team = teams.get(teamId);
    const cells: FplFdrCell[] = [];

    for (const fx of fixtures) {
      const isHome = fx.home_team_id === teamId;
      const isAway = fx.away_team_id === teamId;
      if (!isHome && !isAway) continue;

      const oppId = isHome ? fx.away_team_id : fx.home_team_id;
      const opp = teams.get(oppId);
      cells.push({
        fixture_id: fx.id,
        gw: fx.gw,
        opp: opp?.short ?? String(oppId),
        opp_name: opp?.name ?? String(oppId),
        home: isHome,
        fdr: lookupFplFdr(fdrLookup, team!.code, fx.id),
      });
    }

    rows.push({
      team_id: teamId,
      short: team?.short ?? String(teamId),
      name: team?.name ?? String(teamId),
      fixtures: cells,
    });
  }

  return {
    startGw,
    endGw,
    gwHeaders,
    gwBlocks: buildGwBlocks(),
    rows,
    dgwKeys,
    fplSeason,
  };
}
