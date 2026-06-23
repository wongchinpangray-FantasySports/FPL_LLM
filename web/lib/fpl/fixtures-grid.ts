import { fplGet } from "@/lib/fpl";
import { buildFplFdrLookup, buildH2HStore, lookupFplFdr } from "@/lib/fpl/fdr";
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

type FplEvent = {
  id: number;
  is_current?: boolean;
  is_next?: boolean;
  finished?: boolean;
  deadline_time?: string | null;
};

type FplBootstrapTeam = {
  id: number;
  name: string;
  short_name: string;
};

type FplBootstrap = {
  events?: FplEvent[];
  teams?: FplBootstrapTeam[];
};

type FplApiFixture = {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_score?: number | null;
  team_a_score?: number | null;
  finished?: boolean;
  kickoff_time?: string | null;
};

/** FPL season key = calendar year the campaign starts (2026 for 2026/27). */
export function resolveSeasonFromEvents(events: FplEvent[]): string {
  if (events.length === 0) return String(new Date().getFullYear());

  const allFinished = events.every((e) => e.finished);
  const first = events.reduce((a, b) => (a.id < b.id ? a : b));
  const last = events.reduce((a, b) => (a.id > b.id ? a : b));

  if (allFinished && last.deadline_time && last.deadline_time.length >= 4) {
    const lastYear = last.deadline_time.slice(0, 4);
    if (/^\d{4}$/.test(lastYear)) return lastYear;
  }

  if (first.deadline_time && first.deadline_time.length >= 4) {
    const startYear = first.deadline_time.slice(0, 4);
    if (/^\d{4}$/.test(startYear)) return startYear;
  }

  return String(new Date().getFullYear());
}

function buildGwBlocks(): FplGwBlock[] {
  return FPL_GW_BLOCK_RANGES.map(([fromGw, toGw]) => ({
    fromGw,
    toGw,
    label: `GW${fromGw}–${toGw}`,
  }));
}

function buildDoubleGameweekKeys(
  fixtures: FplApiFixture[],
  teamIds: number[],
  fromGw: number,
  toGw: number,
): string[] {
  const want = new Set(teamIds);
  const counts = new Map<string, number>();

  for (const fx of fixtures) {
    const gw = fx.event;
    if (gw == null || gw < fromGw || gw > toGw) continue;
    for (const tid of [fx.team_h, fx.team_a]) {
      if (!want.has(tid)) continue;
      const key = `${tid}:${gw}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return [...counts.entries()].filter(([, n]) => n >= 2).map(([k]) => k);
}

export async function buildFplFixtureGrid(): Promise<FplFixtureGrid> {
  const [bootstrap, fixtures] = await Promise.all([
    fplGet<FplBootstrap>("/bootstrap-static/"),
    fplGet<FplApiFixture[]>("/fixtures/"),
  ]);

  const events = bootstrap.events ?? [];
  const startGw = 1;
  const endGw = FPL_LAST_SEASON_GW;
  const fplSeason = resolveSeasonFromEvents(events);
  const teams = new Map(
    (bootstrap.teams ?? []).map((t) => [
      t.id,
      { id: t.id, short: t.short_name, name: t.name },
    ]),
  );
  const teamIds = [...teams.keys()].sort((a, b) =>
    (teams.get(a)?.short ?? "").localeCompare(teams.get(b)?.short ?? ""),
  );

  const seasonFx = fixtures.filter(
    (f) => f.event != null && f.event >= startGw && f.event <= endGw,
  );

  const h2hStore = await buildH2HStore(fixtures);
  const fdrLookup = buildFplFdrLookup(
    seasonFx.map((f) => ({
      id: f.id,
      home_team_id: f.team_h,
      away_team_id: f.team_a,
    })),
    h2hStore,
  );

  const dgwKeys = buildDoubleGameweekKeys(
    fixtures,
    teamIds,
    startGw,
    endGw,
  );
  const gwHeaders = Array.from(
    { length: endGw - startGw + 1 },
    (_, i) => startGw + i,
  );

  const rows: FplFdrRow[] = [];
  for (const teamId of teamIds) {
    const team = teams.get(teamId);
    const cells: FplFdrCell[] = [];

    for (const fx of seasonFx) {
      const isHome = fx.team_h === teamId;
      const isAway = fx.team_a === teamId;
      if (!isHome && !isAway) continue;

      const oppId = isHome ? fx.team_a : fx.team_h;
      const opp = teams.get(oppId);
      cells.push({
        fixture_id: fx.id,
        gw: fx.event as number,
        opp: opp?.short ?? String(oppId),
        opp_name: opp?.name ?? String(oppId),
        home: isHome,
        fdr: lookupFplFdr(fdrLookup, teamId, fx.id),
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
