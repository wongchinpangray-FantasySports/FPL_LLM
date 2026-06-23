import { fplGet } from "@/lib/fpl";
import type { TeamStrength } from "@/lib/xp";
import { buildFplFdrLookup, lookupFplFdr } from "@/lib/fpl/fdr";
import { FPL_LAST_SEASON_GW } from "@/lib/dashboard";

const STRENGTH_BASELINE = 1100;

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

export type FplFixtureGrid = {
  startGw: number;
  horizon: number;
  gwHeaders: number[];
  rows: FplFdrRow[];
  dgwKeys: string[];
  fplSeason: string;
};

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
  strength_attack_home?: number;
  strength_attack_away?: number;
  strength_defence_home?: number;
  strength_defence_away?: number;
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

export function resolveFixtureGridStartGw(events: FplEvent[]): number {
  if (events.length === 0) return 1;

  const allFinished = events.every((e) => e.finished);
  if (allFinished) return 1;

  const current = events.find((e) => e.is_current);
  const next = events.find((e) => e.is_next);

  if (current && !current.finished) return current.id;
  if (next) return next.id;
  if (current) return Math.min(current.id + 1, FPL_LAST_SEASON_GW);
  return 1;
}

function teamsMapFromBootstrap(
  teams: FplBootstrapTeam[],
): Map<number, TeamStrength> {
  const out = new Map<number, TeamStrength>();
  for (const t of teams) {
    out.set(t.id, {
      id: t.id,
      short: t.short_name,
      name: t.name,
      attack_home: t.strength_attack_home || STRENGTH_BASELINE,
      attack_away: t.strength_attack_away || STRENGTH_BASELINE,
      defence_home: t.strength_defence_home || STRENGTH_BASELINE,
      defence_away: t.strength_defence_away || STRENGTH_BASELINE,
    });
  }
  return out;
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

export async function buildFplFixtureGrid(
  horizonInput = 6,
): Promise<FplFixtureGrid> {
  const [bootstrap, fixtures] = await Promise.all([
    fplGet<FplBootstrap>("/bootstrap-static/"),
    fplGet<FplApiFixture[]>("/fixtures/"),
  ]);

  const events = bootstrap.events ?? [];
  const startGw = resolveFixtureGridStartGw(events);
  const horizon = Math.max(
    1,
    Math.min(horizonInput, FPL_LAST_SEASON_GW - startGw + 1),
  );
  const endGw = startGw + horizon - 1;
  const fplSeason = resolveSeasonFromEvents(events);
  const teams = teamsMapFromBootstrap(bootstrap.teams ?? []);
  const teamIds = [...teams.keys()].sort((a, b) =>
    (teams.get(a)?.short ?? "").localeCompare(teams.get(b)?.short ?? ""),
  );

  const windowFx = fixtures.filter(
    (f) => f.event != null && f.event >= startGw && f.event <= endGw,
  );
  const fdrPool = fixtures.filter(
    (f) => f.event != null && f.event >= startGw && !f.finished,
  );
  const fdrLookup = buildFplFdrLookup(
    teams,
    fdrPool.map((f) => ({
      id: f.id,
      home_team_id: f.team_h,
      away_team_id: f.team_a,
    })),
  );
  const dgwKeys = buildDoubleGameweekKeys(fixtures, teamIds, startGw, endGw);
  const gwHeaders = Array.from({ length: horizon }, (_, i) => startGw + i);

  const rows: FplFdrRow[] = [];
  for (const teamId of teamIds) {
    const team = teams.get(teamId);
    const cells: FplFdrCell[] = [];

    for (const fx of windowFx) {
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
    horizon,
    gwHeaders,
    rows,
    dgwKeys,
    fplSeason,
  };
}
