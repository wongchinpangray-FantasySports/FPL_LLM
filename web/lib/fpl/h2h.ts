import {
  attackRateFromStrength,
  defWeaknessFromStrength,
  strengthForCode,
  type TeamFplStrength,
} from "@/lib/fpl/strength";
import { getServerSupabase } from "@/lib/supabase";

export type H2HBucket = {
  games: number;
  goalsFor: number;
  goalsAgainst: number;
};

const venueKey = (team: string, opp: string, home: boolean) =>
  `${team}:${opp}:${home ? "H" : "A"}`;

const pairKey = (team: string, opp: string) => `${team}:${opp}`;

const HOME_BASE = 1.45;
const AWAY_BASE = 1.15;

/** Blend FPL strength more heavily — historical venue rates mis-rank these sides. */
const FPL_STRENGTH_ANCHOR = new Set([
  "BOU",
  "CHE",
  "CRY",
  "EVE",
  "SUN",
  "TOT",
]);

const DEFAULT_FPL_BLEND = 0.55;
const ANCHOR_FPL_BLEND = 0.75;

/** Floor on historical defensive weakness for top sides (before FPL blend). */
const ELITE_HIST_DEF_CAP: Record<string, { home: number; away: number }> = {
  MCI: { home: 0.62, away: 0.65 },
  LIV: { home: 0.68, away: 0.7 },
  ARS: { home: 0.72, away: 0.75 },
  CHE: { home: 0.74, away: 0.72 },
  NEW: { home: 0.82, away: 0.85 },
};

/** H2H + venue strength keyed by FPL-style club codes (ARS, COV, …). */
export class H2HStore {
  private venue = new Map<string, H2HBucket>();
  private any = new Map<string, H2HBucket>();
  private homeProfile = new Map<string, H2HBucket>();
  private awayProfile = new Map<string, H2HBucket>();

  leagueHomeGpg = HOME_BASE;
  leagueAwayGpg = AWAY_BASE;
  leagueHomeGpgConceded = HOME_BASE;
  leagueAwayGpgConceded = AWAY_BASE;

  addMatch(team: string, opp: string, home: boolean, gf: number, ga: number) {
    if (team === opp) return;
    this.bump(this.venue, venueKey(team, opp, home), gf, ga);
    this.bump(this.any, pairKey(team, opp), gf, ga);

    const profile = home ? this.homeProfile : this.awayProfile;
    const oppProfile = home ? this.awayProfile : this.homeProfile;
    this.bumpTeam(profile, team, gf, ga);
    this.bumpTeam(oppProfile, opp, ga, gf);

    this.recomputeLeagueAvgs();
  }

  private bumpTeam(
    map: Map<string, H2HBucket>,
    team: string,
    gf: number,
    ga: number,
  ) {
    const cur = map.get(team) ?? { games: 0, goalsFor: 0, goalsAgainst: 0 };
    cur.games += 1;
    cur.goalsFor += gf;
    cur.goalsAgainst += ga;
    map.set(team, cur);
  }

  private bump(map: Map<string, H2HBucket>, key: string, gf: number, ga: number) {
    const cur = map.get(key) ?? { games: 0, goalsFor: 0, goalsAgainst: 0 };
    cur.games += 1;
    cur.goalsFor += gf;
    cur.goalsAgainst += ga;
    map.set(key, cur);
  }

  private avgGpg(map: Map<string, H2HBucket>, field: "goalsFor" | "goalsAgainst") {
    let total = 0;
    let games = 0;
    for (const b of map.values()) {
      total += b[field];
      games += b.games;
    }
    return games > 0 ? total / games : null;
  }

  private recomputeLeagueAvgs() {
    const homeGf = this.avgGpg(this.homeProfile, "goalsFor");
    const awayGf = this.avgGpg(this.awayProfile, "goalsFor");
    const homeGa = this.avgGpg(this.homeProfile, "goalsAgainst");
    const awayGa = this.avgGpg(this.awayProfile, "goalsAgainst");
    if (homeGf != null) this.leagueHomeGpg = homeGf;
    if (awayGf != null) this.leagueAwayGpg = awayGf;
    if (homeGa != null) this.leagueHomeGpgConceded = homeGa;
    if (awayGa != null) this.leagueAwayGpgConceded = awayGa;
  }

  getVenue(team: string, opp: string, home: boolean): H2HBucket | null {
    return this.venue.get(venueKey(team, opp, home)) ?? null;
  }

  getAny(team: string, opp: string): H2HBucket | null {
    return this.any.get(pairKey(team, opp)) ?? null;
  }

  private rate(
    map: Map<string, H2HBucket>,
    team: string,
    field: "goalsFor" | "goalsAgainst",
    baseline: number,
  ): number {
    const t = map.get(team);
    if (!t || t.games < 4) return 1;
    return t[field] / t.games / baseline;
  }

  getHomeAttackRate(team: string): number {
    return this.rate(this.homeProfile, team, "goalsFor", this.leagueHomeGpg);
  }

  getAwayAttackRate(team: string): number {
    return this.rate(this.awayProfile, team, "goalsFor", this.leagueAwayGpg);
  }

  /** Opponent goals conceded at the relevant venue (higher = leakier). */
  getHomeDefWeakness(team: string): number {
    return this.rate(this.homeProfile, team, "goalsAgainst", this.leagueHomeGpgConceded);
  }

  getAwayDefWeakness(team: string): number {
    return this.rate(this.awayProfile, team, "goalsAgainst", this.leagueAwayGpgConceded);
  }

  historicalDefWeakness(opp: string, home: boolean): number {
    return home ? this.getAwayDefWeakness(opp) : this.getHomeDefWeakness(opp);
  }
}

function fplBlendWeight(code: string): number {
  return FPL_STRENGTH_ANCHOR.has(code) ? ANCHOR_FPL_BLEND : DEFAULT_FPL_BLEND;
}

function capHistoricalDefWeakness(
  opp: string,
  home: boolean,
  weakness: number,
): number {
  const cap = ELITE_HIST_DEF_CAP[opp];
  if (!cap) return weakness;
  const maxW = home ? cap.away : cap.home;
  return Math.min(weakness, maxW);
}

function blendDefWeakness(
  opp: string,
  home: boolean,
  store: H2HStore,
  strengths: Map<string, TeamFplStrength>,
): number {
  const fpl = defWeaknessFromStrength(strengthForCode(strengths, opp), home);
  const hist = capHistoricalDefWeakness(
    opp,
    home,
    store.historicalDefWeakness(opp, home),
  );
  const w = fplBlendWeight(opp);
  return w * fpl + (1 - w) * hist;
}

function blendAttackRate(
  team: string,
  home: boolean,
  store: H2HStore,
  strengths: Map<string, TeamFplStrength>,
): number {
  const fpl = attackRateFromStrength(strengthForCode(strengths, team), home);
  const hist = home
    ? store.getHomeAttackRate(team)
    : store.getAwayAttackRate(team);
  const w = fplBlendWeight(team);
  return w * fpl + (1 - w) * hist;
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
  const byFixture = new Map<string, AggregatedMatch>();

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

/** Baseline expected goals-for from venue attack × opponent venue defence. */
export function modelAttackEase(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
  strengths: Map<string, TeamFplStrength>,
): number {
  const oppDef = blendDefWeakness(opp, home, store, strengths);
  const atk = blendAttackRate(team, home, store, strengths);
  return (home ? HOME_BASE : AWAY_BASE) * atk * oppDef;
}

function h2hGoalDelta(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
  model: number,
): number {
  const venue = store.getVenue(team, opp, home);
  const any = store.getAny(team, opp);

  let h2hGpg: number | null = null;
  let games = 0;
  if (venue && venue.games >= MIN_VENUE_GAMES) {
    h2hGpg = venue.goalsFor / venue.games;
    games = venue.games;
  } else if (any && any.games >= MIN_PAIR_GAMES) {
    const gpg = any.goalsFor / any.games;
    h2hGpg = home ? gpg * 1.08 : gpg * 0.92;
    games = any.games;
  } else if (any && any.games >= 1) {
    const gpg = any.goalsFor / any.games;
    h2hGpg = home ? gpg * 1.05 : gpg * 0.95;
    games = any.games;
  }

  if (h2hGpg == null) return 0;

  const weight = clamp(games / 10, 0.15, 0.4);
  return clamp((h2hGpg - model) * weight, -0.22, 0.22);
}

/** Expected goals-for for an attack fixture (higher = easier). */
export function projectH2HAttackEase(
  team: string,
  opp: string,
  home: boolean,
  store: H2HStore,
  strengths: Map<string, TeamFplStrength>,
): number {
  const model = modelAttackEase(team, opp, home, store, strengths);
  const delta = h2hGoalDelta(team, opp, home, store, model);
  return clamp(model + delta, 0.35, 2.6);
}
