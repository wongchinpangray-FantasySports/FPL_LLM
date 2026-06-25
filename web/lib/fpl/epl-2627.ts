import fixturesData from "@/data/epl-2627-fixtures.json";
export {
  EPL_2627_PROMOTED,
  EPL_2627_RELEGATED,
  fplApiHasStale2627Teams,
} from "@/lib/fpl/epl-2627-clubs";

export type Epl2627Team = {
  id: number;
  code: string;
  short: string;
  name: string;
};

export type Epl2627Fixture = {
  id: number;
  gw: number;
  home_team_id: number;
  away_team_id: number;
  kickoff_time: string | null;
};

export type Epl2627Season = {
  season: string;
  source: string;
  teams: Epl2627Team[];
  fixtures: Epl2627Fixture[];
};

const data = fixturesData as Epl2627Season;

/** Official 2026/27 PL fixtures (released 19 Jun 2026). FPL API may lag on promoted teams. */
export function getEpl2627Season(): Epl2627Season {
  return data;
}

export function getEpl2627Teams(): Map<number, Epl2627Team> {
  return new Map(data.teams.map((t) => [t.id, t]));
}

export function getEpl2627Fixtures(): Epl2627Fixture[] {
  return data.fixtures;
}
