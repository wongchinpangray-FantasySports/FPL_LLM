import { getServerSupabase } from "@/lib/supabase";

export type H2HBucket = {
  games: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type TeamMatch = {
  teamId: number;
  oppId: number;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
};

const venueKey = (teamId: number, oppId: number, home: boolean) =>
  `${teamId}:${oppId}:${home ? "H" : "A"}`;

const pairKey = (teamId: number, oppId: number) => `${teamId}:${oppId}`;

export class H2HStore {
  private venue = new Map<string, H2HBucket>();
  private any = new Map<string, H2HBucket>();
  private teamTotals = new Map<number, H2HBucket>();
  leagueAvgGpg = 1.35;

  addMatch(teamId: number, oppId: number, home: boolean, gf: number, ga: number) {
    if (teamId === oppId) return;
    this.bump(this.venue, venueKey(teamId, oppId, home), gf, ga);
    this.bump(this.any, pairKey(teamId, oppId), gf, ga);
    const team = this.teamTotals.get(teamId) ?? {
      games: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    };
    team.games += 1;
    team.goalsFor += gf;
    team.goalsAgainst += ga;
    this.teamTotals.set(teamId, team);
    this.recomputeLeagueAvg();
  }

  private bump(map: Map<string, H2HBucket>, key: string, gf: number, ga: number) {
    const cur = map.get(key) ?? { games: 0, goalsFor: 0, goalsAgainst: 0 };
    cur.games += 1;
    cur.goalsFor += gf;
    cur.goalsAgainst += ga;
    map.set(key, cur);
  }

  private recomputeLeagueAvg() {
    let gf = 0;
    let games = 0;
    for (const b of this.teamTotals.values()) {
      gf += b.goalsFor;
      games += b.games;
    }
    if (games > 0) this.leagueAvgGpg = gf / games;
  }

  getVenue(teamId: number, oppId: number, home: boolean): H2HBucket | null {
    return this.venue.get(venueKey(teamId, oppId, home)) ?? null;
  }

  getAny(teamId: number, oppId: number): H2HBucket | null {
    return this.any.get(pairKey(teamId, oppId)) ?? null;
  }

  getTeamAttackRate(teamId: number): number {
    const t = this.teamTotals.get(teamId);
    if (!t || t.games === 0) return 1;
    return t.goalsFor / t.games / this.leagueAvgGpg;
  }

  getTeamDefRate(teamId: number): number {
    const t = this.teamTotals.get(teamId);
    if (!t || t.games === 0) return 1;
    return t.goalsAgainst / t.games / this.leagueAvgGpg;
  }
}

function aggregatePlayerRows(
  rows: Array<{
    season: string;
    fixture_id: number | null;
    opponent_team_id: number | null;
    was_home: boolean | null;
    goals_scored: number | null;
    goals_conceded: number | null;
    minutes: number | null;
    player_id: number;
  }>,
  teamByPlayer: Map<number, number>,
): Array<TeamMatch & { season: string; fixtureId: number }> {
  type Acc = {
    season: string;
    fixtureId: number;
    teamId: number;
    oppId: number;
    home: boolean;
    goalsFor: number;
    goalsAgainst: number;
  };
  const byFixture = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.fixture_id || !row.opponent_team_id || (row.minutes ?? 0) <= 0) {
      continue;
    }
    const teamId = teamByPlayer.get(row.player_id);
    if (!teamId) continue;

    const key = `${row.season}:${row.fixture_id}:${teamId}`;
    let acc = byFixture.get(key);
    if (!acc) {
      acc = {
        season: row.season,
        fixtureId: row.fixture_id,
        teamId,
        oppId: row.opponent_team_id,
        home: Boolean(row.was_home),
        goalsFor: 0,
        goalsAgainst: row.goals_conceded ?? 0,
      };
      byFixture.set(key, acc);
    }
    acc.goalsFor += row.goals_scored ?? 0;
    acc.goalsAgainst = Math.max(acc.goalsAgainst, row.goals_conceded ?? 0);
  }

  return [...byFixture.values()].map((a) => ({
    season: a.season,
    fixtureId: a.fixtureId,
    teamId: a.teamId,
    oppId: a.oppId,
    home: a.home,
    goalsFor: a.goalsFor,
    goalsAgainst: a.goalsAgainst,
  }));
}

async function loadTeamByPlayerMap(): Promise<Map<number, number>> {
  const supa = getServerSupabase();
  const out = new Map<number, number>();
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data } = await supa
      .from("players_static")
      .select("fpl_id,team_id")
      .not("team_id", "is", null)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    for (const row of data) {
      out.set(row.fpl_id as number, row.team_id as number);
    }
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return out;
}

async function loadPlayerGwRows(): Promise<
  Array<{
    season: string;
    fixture_id: number | null;
    opponent_team_id: number | null;
    was_home: boolean | null;
    goals_scored: number | null;
    goals_conceded: number | null;
    minutes: number | null;
    player_id: number;
  }>
> {
  const supa = getServerSupabase();
  const rows: Array<{
    season: string;
    fixture_id: number | null;
    opponent_team_id: number | null;
    was_home: boolean | null;
    goals_scored: number | null;
    goals_conceded: number | null;
    minutes: number | null;
    player_id: number;
  }> = [];
  const PAGE = 5000;
  let from = 0;

  while (true) {
    const { data } = await supa
      .from("player_gw_stats")
      .select(
        "season,fixture_id,opponent_team_id,was_home,goals_scored,goals_conceded,minutes,player_id",
      )
      .not("fixture_id", "is", null)
      .gt("minutes", 0)
      .range(from, from + PAGE - 1);
    if (!data?.length) break;
    rows.push(...data);
    from += PAGE;
    if (data.length < PAGE) break;
  }
  return rows;
}

async function loadFinishedFixturesFromDb(): Promise<
  Array<{
    id: number;
    home_team_id: number;
    away_team_id: number;
    home_team_score: number | null;
    away_team_score: number | null;
  }>
> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select("id,home_team_id,away_team_id,home_team_score,away_team_score")
    .eq("finished", true)
    .not("home_team_score", "is", null)
    .not("away_team_score", "is", null);
  return data ?? [];
}

function ingestMatch(
  store: H2HStore,
  seen: Set<string>,
  key: string,
  teamId: number,
  oppId: number,
  home: boolean,
  gf: number,
  ga: number,
) {
  if (seen.has(key)) return;
  seen.add(key);
  store.addMatch(teamId, oppId, home, gf, ga);
}

export function addApiFinishedFixtures(
  store: H2HStore,
  fixtures: Array<{
    id?: number;
    team_h: number;
    team_a: number;
    team_h_score?: number | null;
    team_a_score?: number | null;
    finished?: boolean;
  }>,
  seen = new Set<string>(),
) {
  for (const f of fixtures) {
    if (!f.finished) continue;
    if (f.team_h_score == null || f.team_a_score == null) continue;
    const fxKey = f.id != null ? String(f.id) : `${f.team_h}-${f.team_a}-${f.team_h_score}-${f.team_a_score}`;
    ingestMatch(store, seen, `fx:${fxKey}:h`, f.team_h, f.team_a, true, f.team_h_score, f.team_a_score);
    ingestMatch(store, seen, `fx:${fxKey}:a`, f.team_a, f.team_h, false, f.team_a_score, f.team_h_score);
  }
}

export async function buildH2HStore(
  apiFixtures: Array<{
    id?: number;
    team_h: number;
    team_a: number;
    team_h_score?: number | null;
    team_a_score?: number | null;
    finished?: boolean;
  }> = [],
): Promise<H2HStore> {
  const store = new H2HStore();
  const seen = new Set<string>();
  const [teamByPlayer, pgsRows, dbFixtures] = await Promise.all([
    loadTeamByPlayerMap(),
    loadPlayerGwRows(),
    loadFinishedFixturesFromDb(),
  ]);

  for (const m of aggregatePlayerRows(pgsRows, teamByPlayer)) {
    ingestMatch(
      store,
      seen,
      `pgs:${m.season}:${m.fixtureId}:${m.teamId}`,
      m.teamId,
      m.oppId,
      m.home,
      m.goalsFor,
      m.goalsAgainst,
    );
  }

  for (const f of dbFixtures) {
    ingestMatch(
      store,
      seen,
      `fx:${f.id}:h`,
      f.home_team_id,
      f.away_team_id,
      true,
      f.home_team_score as number,
      f.away_team_score as number,
    );
    ingestMatch(
      store,
      seen,
      `fx:${f.id}:a`,
      f.away_team_id,
      f.home_team_id,
      false,
      f.away_team_score as number,
      f.home_team_score as number,
    );
  }

  addApiFinishedFixtures(store, apiFixtures, seen);
  return store;
}

/** Minimum H2H sample before trusting venue-specific data. */
const MIN_VENUE_GAMES = 2;
const MIN_PAIR_GAMES = 3;

/**
 * Expected goals-for for an attack fixture from historical H2H.
 * Higher = easier attacking matchup.
 */
export function projectH2HAttackEase(
  teamId: number,
  oppId: number,
  home: boolean,
  store: H2HStore,
): number {
  const venue = store.getVenue(teamId, oppId, home);
  const any = store.getAny(teamId, oppId);
  const base = store.leagueAvgGpg;

  if (venue && venue.games >= MIN_VENUE_GAMES) {
    return venue.goalsFor / venue.games;
  }

  if (any && any.games >= MIN_PAIR_GAMES) {
    const gpg = any.goalsFor / any.games;
    return home ? gpg * 1.15 : gpg * 0.9;
  }

  if (any && any.games >= 1) {
    const gpg = any.goalsFor / any.games;
    const blended = home ? gpg * 1.12 : gpg * 0.92;
    const teamRate = store.getTeamAttackRate(teamId);
    const oppDef = store.getTeamDefRate(oppId);
    return blended * 0.55 + base * teamRate * (1 / oppDef) * 0.45;
  }

  const teamRate = store.getTeamAttackRate(teamId);
  const oppDef = store.getTeamDefRate(oppId);
  const venueBoost = home ? 1.12 : 0.92;
  return base * teamRate * (1 / oppDef) * venueBoost;
}
