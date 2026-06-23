import { getServerSupabase } from "@/lib/supabase";

export type H2HBucket = {
  games: number;
  goalsFor: number;
  goalsAgainst: number;
};

const venueKey = (team: string, opp: string, home: boolean) =>
  `${team}:${opp}:${home ? "H" : "A"}`;

const pairKey = (team: string, opp: string) => `${team}:${opp}`;

/** H2H keyed by FPL-style club codes (ARS, COV, …). */
export class H2HStore {
  private venue = new Map<string, H2HBucket>();
  private any = new Map<string, H2HBucket>();
  private teamTotals = new Map<string, H2HBucket>();
  leagueAvgGpg = 1.35;

  addMatch(team: string, opp: string, home: boolean, gf: number, ga: number) {
    if (team === opp) return;
    this.bump(this.venue, venueKey(team, opp, home), gf, ga);
    this.bump(this.any, pairKey(team, opp), gf, ga);
    const cur = this.teamTotals.get(team) ?? {
      games: 0,
      goalsFor: 0,
      goalsAgainst: 0,
    };
    cur.games += 1;
    cur.goalsFor += gf;
    cur.goalsAgainst += ga;
    this.teamTotals.set(team, cur);
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

  getVenue(team: string, opp: string, home: boolean): H2HBucket | null {
    return this.venue.get(venueKey(team, opp, home)) ?? null;
  }

  getAny(team: string, opp: string): H2HBucket | null {
    return this.any.get(pairKey(team, opp)) ?? null;
  }

  getTeamAttackRate(team: string): number {
    const t = this.teamTotals.get(team);
    if (!t || t.games === 0) return 1;
    return t.goalsFor / t.games / this.leagueAvgGpg;
  }

  getTeamDefRate(team: string): number {
    const t = this.teamTotals.get(team);
    if (!t || t.games === 0) return 1;
    /** Goals conceded per game vs league average (higher = leakier defence). */
    return t.goalsAgainst / t.games / this.leagueAvgGpg;
  }
}

async function loadFplTeamCodeMap(): Promise<Map<number, string>> {
  const supa = getServerSupabase();
  const { data } = await supa.from("teams").select("id,short_name");
  const out = new Map<number, string>();
  for (const row of data ?? []) {
    const code = String(row.short_name ?? "").trim().toUpperCase();
    if (code) out.set(row.id as number, code);
  }
  return out;
}

async function loadTeamCodeByPlayer(
  teamCodeById: Map<number, string>,
): Promise<Map<number, string>> {
  const supa = getServerSupabase();
  const out = new Map<number, string>();
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
      const code = teamCodeById.get(row.team_id as number);
      if (code) out.set(row.fpl_id as number, code);
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

type AggregatedMatch = {
  season: string;
  fixtureId: number;
  team: string;
  opp: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
};

function aggregatePlayerRows(
  rows: Awaited<ReturnType<typeof loadPlayerGwRows>>,
  teamCodeByPlayer: Map<number, string>,
  teamCodeById: Map<number, string>,
): AggregatedMatch[] {
  type Acc = AggregatedMatch;
  const byFixture = new Map<string, Acc>();

  for (const row of rows) {
    if (!row.fixture_id || !row.opponent_team_id || (row.minutes ?? 0) <= 0) {
      continue;
    }
    const team = teamCodeByPlayer.get(row.player_id);
    const opp = teamCodeById.get(row.opponent_team_id);
    if (!team || !opp) continue;

    const key = `${row.season}:${row.fixture_id}:${team}`;
    let acc = byFixture.get(key);
    if (!acc) {
      acc = {
        season: row.season,
        fixtureId: row.fixture_id,
        team,
        opp,
        home: Boolean(row.was_home),
        goalsFor: 0,
        goalsAgainst: row.goals_conceded ?? 0,
      };
      byFixture.set(key, acc);
    }
    acc.goalsFor += row.goals_scored ?? 0;
    acc.goalsAgainst = Math.max(acc.goalsAgainst, row.goals_conceded ?? 0);
  }

  return [...byFixture.values()];
}

async function loadFinishedFixturesFromDb(
  teamCodeById: Map<number, string>,
): Promise<
  Array<{
    id: number;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  }>
> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select("id,home_team_id,away_team_id,home_team_score,away_team_score")
    .eq("finished", true)
    .not("home_team_score", "is", null)
    .not("away_team_score", "is", null);

  const out: Array<{
    id: number;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  }> = [];

  for (const row of data ?? []) {
    const home = teamCodeById.get(row.home_team_id as number);
    const away = teamCodeById.get(row.away_team_id as number);
    if (!home || !away) continue;
    out.push({
      id: row.id as number,
      home,
      away,
      homeScore: row.home_team_score as number,
      awayScore: row.away_team_score as number,
    });
  }
  return out;
}

function ingestMatch(
  store: H2HStore,
  seen: Set<string>,
  key: string,
  team: string,
  opp: string,
  home: boolean,
  gf: number,
  ga: number,
) {
  if (seen.has(key)) return;
  seen.add(key);
  store.addMatch(team, opp, home, gf, ga);
}

export async function buildH2HStore(): Promise<H2HStore> {
  const store = new H2HStore();
  const seen = new Set<string>();
  const teamCodeById = await loadFplTeamCodeMap();
  const [teamCodeByPlayer, pgsRows, dbFixtures] = await Promise.all([
    loadTeamCodeByPlayer(teamCodeById),
    loadPlayerGwRows(),
    loadFinishedFixturesFromDb(teamCodeById),
  ]);

  for (const m of aggregatePlayerRows(pgsRows, teamCodeByPlayer, teamCodeById)) {
    ingestMatch(
      store,
      seen,
      `pgs:${m.season}:${m.fixtureId}:${m.team}`,
      m.team,
      m.opp,
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
      f.home,
      f.away,
      true,
      f.homeScore,
      f.awayScore,
    );
    ingestMatch(
      store,
      seen,
      `fx:${f.id}:a`,
      f.away,
      f.home,
      false,
      f.awayScore,
      f.homeScore,
    );
  }

  return store;
}

const MIN_VENUE_GAMES = 2;
const MIN_PAIR_GAMES = 3;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Baseline expected goals-for from team attack × opponent defensive weakness. */
export function modelAttackEase(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
): number {
  const base = store.leagueAvgGpg;
  const teamRate = store.getTeamAttackRate(team);
  /** Higher = concedes more relative to league avg → easier to score against. */
  const oppDefWeakness = store.getTeamDefRate(opp);
  const venueBoost = home ? 1.12 : 0.88;
  return base * teamRate * oppDefWeakness * venueBoost;
}

/** H2H adjustment vs model (capped so one outlier derby cannot flip elite oppositions). */
function h2hMultiplier(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
  model: number,
): number {
  const venue = store.getVenue(team, opp, home);
  const any = store.getAny(team, opp);

  let h2hGpg: number | null = null;
  if (venue && venue.games >= MIN_VENUE_GAMES) {
    h2hGpg = venue.goalsFor / venue.games;
  } else if (any && any.games >= MIN_PAIR_GAMES) {
    const gpg = any.goalsFor / any.games;
    h2hGpg = home ? gpg * 1.1 : gpg * 0.9;
  } else if (any && any.games >= 1) {
    const gpg = any.goalsFor / any.games;
    h2hGpg = home ? gpg * 1.08 : gpg * 0.92;
  }

  if (h2hGpg == null) return 1;

  const safeModel = Math.max(0.45, model);
  const ratio = h2hGpg / safeModel;
  const games = venue?.games ?? any?.games ?? 0;
  const weight = clamp(games / 8, 0.25, 0.65);
  const adjusted = 1 + (ratio - 1) * weight;
  return clamp(adjusted, 0.78, 1.22);
}

/** Expected goals-for for an attack fixture (higher = easier). Used for FDR quintiles. */
export function projectH2HAttackEase(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
): number {
  const model = modelAttackEase(team, opp, home, store);
  return model * h2hMultiplier(team, opp, home, store, model);
}
