/**
 * Expected-points (xP) engine for FPL.
 *
 * Given a player and a target gameweek, we project an FPL points expectation
 * using:
 *
 *  1. Rolling per-90 rates over the last N GWs (xG, xA, bonus, BPS, saves,
 *     starts, minutes) from `player_gw_stats`, smoothed with season totals
 *     from `players_static`.
 *  2. Team-level expected goals for/against for the specific fixture, using
 *     FPL's attack/defence strength ratings (baseline ~1100) blended with
 *     home/away scoring baselines (1.45 home / 1.15 away).
 *  3. Poisson cleansheet probability = exp(-lambda_against).
 *  4. Position-dependent FPL scoring rules (goals: GKP/DEF 6, MID 5, FWD 4;
 *     CS: GKP/DEF 4, MID 1; GC: -1 per 2 conceded for GKP/DEF; saves: 1 per
 *     3 for GKP; assists: 3 for all).
 *  5. Availability gating via status / chance_of_playing.
 *
 * All tools (captain, transfers, differentials, chip strategy) go through
 * this single projection so recommendations are internally consistent.
 */

import { getServerSupabase } from "./supabase";

export interface TeamStrength {
  id: number;
  short: string;
  name: string;
  attack_home: number;
  attack_away: number;
  defence_home: number;
  defence_away: number;
}

export interface Fixture {
  id: number;
  gw: number;
  home_team_id: number;
  away_team_id: number;
  home_fdr: number | null;
  away_fdr: number | null;
  finished: boolean;
  kickoff_time: string | null;
}

export interface PlayerCoreRow {
  fpl_id: number;
  web_name: string | null;
  name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  status: string | null;
  chance_of_playing: number | null;
  form: number | null;
  points_per_game: number | null;
  total_points: number | null;
  minutes: number | null;
  goals_scored: number | null;
  assists: number | null;
  clean_sheets: number | null;
  bonus: number | null;
  bps: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
  expected_goal_involve: number | null;
  selected_by_percent: number | null;
  penalties_order?: number | null;
  direct_freekicks_order?: number | null;
  corners_and_indirect_freekicks_order?: number | null;
  // defensive (2025/26 FPL DC scoring)
  goals_conceded?: number | null;
  expected_goals_conceded?: number | null;
  saves?: number | null;
  clearances_blocks_interceptions?: number | null;
  recoveries?: number | null;
  tackles?: number | null;
  defensive_contribution?: number | null;
  defensive_contribution_per_90?: number | null;
  expected_goals_conceded_per_90?: number | null;
  saves_per_90?: number | null;
  starts?: number | null;
  starts_per_90?: number | null;
}

export interface SetPieceFlags {
  penalties: number | null;
  freekicks: number | null;
  corners: number | null;
  score: number; // 0..1 rough "set-piece involvement" score
}

export interface OpponentHistory {
  games: number;
  minutes: number;
  ppg: number | null;
  points: number;
  goals: number;
  assists: number;
}

export interface PlayerRolling {
  window_gws: number;
  minutes: number;
  starts: number;
  apps: number;
  xg: number;
  xa: number;
  xgi: number;
  xgc: number;
  goals: number;
  assists: number;
  cs: number;
  gc: number;
  bonus: number;
  bps: number;
  saves: number;
  points: number;
  // defensive rolling (2025/26 DC)
  cbi: number;
  tackles: number;
  recoveries: number;
  dc_points: number;
  dc_games: number; // games where DC was actually earned
}

export interface FixtureProjection {
  gw: number;
  fixture_id: number;
  opp_team_id: number;
  opp_short: string;
  home: boolean;
  fdr: number | null;
  expected_minutes: number;
  p_appear: number;
  p_60plus: number;
  team_xg_for: number;
  team_xg_against: number;
  p_clean_sheet: number;
  opp_history: OpponentHistory | null;
  opp_history_mult: number;
  xG: number;
  xA: number;
  // defensive-contribution projection
  exp_defensive_actions: number; // expected CBIT (or CBIRT) in this fixture
  dc_threshold: number; // 10 for DEF/GK, 12 for MID/FWD
  p_dc: number; // Poisson P(actions >= threshold)
  xp_appearance: number;
  xp_goals: number;
  xp_assists: number;
  xp_cs: number;
  xp_gc: number;
  xp_saves: number;
  xp_dc: number;
  xp_bonus: number;
  xp_total: number;
}

export interface PlayerProjection {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  team_id: number | null;
  position: string | null;
  price: number | null;
  form: number | null;
  ownership: number | null;
  availability: number;
  availability_note: string | null;
  set_pieces: SetPieceFlags;
  rolling: PlayerRolling;
  fixtures: FixtureProjection[];
  xp_total: number;
  xp_per_game: number;
  value_per_million: number | null;
}

// --- constants -------------------------------------------------------------

const ROLLING_WINDOW = 6;

const HOME_BASE_GOALS = 1.45;
const AWAY_BASE_GOALS = 1.15;
const STRENGTH_BASELINE = 1100;

const GOAL_POINTS: Record<string, number> = {
  GKP: 6,
  DEF: 6,
  MID: 5,
  FWD: 4,
};

const CS_POINTS: Record<string, number> = {
  GKP: 4,
  DEF: 4,
  MID: 1,
  FWD: 0,
};

/** Caps elite-attack fixture inflation so premium forwards don't run away vs DEF */
const ATK_CONTEXT_CAP = 2.0;

/**
 * Fine tune total xP so DEF/GKP sit in realistic bands vs MID/FWD after the
 * structural model (data-driven; tweak if league meta shifts).
 */
const POSITION_XP_CALIBRATION: Record<string, number> = {
  GKP: 1.03,
  DEF: 1.045,
  MID: 1.0,
  FWD: 0.988,
};

/**
 * Bonus correlates with different signals by role: MID/FWD bonus tracks
 * attacking output (atk context); DEF/GKP track CS probability and how much
 * the opponent threatens (not raw team xGF alone).
 */
function bonusContextMultiplier(
  position: string,
  atkContext: number,
  pCS: number,
  teamGA: number,
): number {
  const atk = clamp(atkContext, 0.58, 1.62);
  if (position !== "DEF" && position !== "GKP") return atk;

  const gaNorm = clamp(teamGA / 1.38, 0.42, 2.05);
  const defensiveFixture = clamp(
    0.72 + 0.52 * pCS - 0.24 * gaNorm,
    0.6,
    1.52,
  );
  return clamp(0.22 * atk + 0.78 * defensiveFixture, 0.6, 1.58);
}

function positionCalibration(position: string): number {
  return POSITION_XP_CALIBRATION[position] ?? 1;
}

// --- helpers ---------------------------------------------------------------

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function poissonP0(lambda: number): number {
  if (!Number.isFinite(lambda) || lambda <= 0) return 1;
  return Math.exp(-lambda);
}

/**
 * Poisson upper-tail P(X ≥ k) for non-negative integer k, given rate λ.
 * Uses the recurrence p_{i+1} = p_i * λ / (i+1) to avoid factorials.
 */
function poissonUpperCdf(lambda: number, k: number): number {
  if (!Number.isFinite(lambda) || lambda <= 0) return k <= 0 ? 1 : 0;
  if (k <= 0) return 1;
  let cum = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cum += term;
    term *= lambda / (i + 1);
  }
  return clamp(1 - cum, 0, 1);
}

function round(n: number, d = 2): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

// --- DB loaders ------------------------------------------------------------

export async function loadTeams(): Promise<Map<number, TeamStrength>> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("teams")
    .select(
      "id,short_name,name,strength_attack_home,strength_attack_away,strength_defence_home,strength_defence_away",
    );
  const out = new Map<number, TeamStrength>();
  for (const t of data ?? []) {
    out.set(t.id as number, {
      id: t.id as number,
      short: t.short_name as string,
      name: t.name as string,
      attack_home: num(t.strength_attack_home) || STRENGTH_BASELINE,
      attack_away: num(t.strength_attack_away) || STRENGTH_BASELINE,
      defence_home: num(t.strength_defence_home) || STRENGTH_BASELINE,
      defence_away: num(t.strength_defence_away) || STRENGTH_BASELINE,
    });
  }
  return out;
}

export async function loadFixturesWindow(
  fromGw: number,
  toGw: number,
): Promise<Fixture[]> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select(
      "id,gw,home_team_id,away_team_id,home_fdr,away_fdr,finished,kickoff_time",
    )
    .gte("gw", fromGw)
    .lte("gw", toGw)
    .order("gw", { ascending: true });
  return (data ?? []) as unknown as Fixture[];
}

/**
 * Keys `${teamId}:${gw}` where that team has 2+ fixtures scheduled in the GW
 * (double / triple gameweek). Uses all fixtures including finished ones so the
 * heatmap still shows a DGW ring after the first match has kicked.
 */
export async function loadDoubleGameweekKeys(
  teamIds: number[],
  fromGw: number,
  toGw: number,
): Promise<Set<string>> {
  const out = new Set<string>();
  if (teamIds.length === 0) return out;
  const want = new Set(teamIds);
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select("gw,home_team_id,away_team_id")
    .gte("gw", fromGw)
    .lte("gw", toGw);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const gw = Number(row.gw);
    const h = Number(row.home_team_id);
    const a = Number(row.away_team_id);
    if (want.has(h)) {
      const k = `${h}:${gw}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (want.has(a)) {
      const k = `${a}:${gw}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  for (const [key, n] of counts) {
    if (n >= 2) out.add(key);
  }
  return out;
}

const PLAYER_CORE_COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,status,chance_of_playing,form,points_per_game,total_points,minutes,goals_scored,assists,clean_sheets,bonus,bps,expected_goals,expected_assists,expected_goal_involve,selected_by_percent,penalties_order,direct_freekicks_order,corners_and_indirect_freekicks_order,goals_conceded,expected_goals_conceded,saves,clearances_blocks_interceptions,recoveries,tackles,defensive_contribution,defensive_contribution_per_90,expected_goals_conceded_per_90,saves_per_90,starts,starts_per_90";

export async function loadPlayers(
  ids: number[],
): Promise<Map<number, PlayerCoreRow>> {
  const out = new Map<number, PlayerCoreRow>();
  if (ids.length === 0) return out;
  const supa = getServerSupabase();
  // Try with set-piece cols; if migration 0002 hasn't run yet, fall back to
  // the base column set so the engine still works.
  const first = await supa
    .from("players_static")
    .select(PLAYER_CORE_COLS)
    .in("fpl_id", ids);
  let rows = first.data as unknown as Array<Record<string, unknown>> | null;
  if (first.error) {
    const fallback = await supa
      .from("players_static")
      .select(
        "fpl_id,web_name,name,team,team_id,position,base_price,status,chance_of_playing,form,points_per_game,total_points,minutes,goals_scored,assists,clean_sheets,bonus,bps,expected_goals,expected_assists,expected_goal_involve,selected_by_percent",
      )
      .in("fpl_id", ids);
    rows = fallback.data as unknown as Array<Record<string, unknown>> | null;
  }
  for (const r of rows ?? []) {
    out.set(Number(r.fpl_id), r as unknown as PlayerCoreRow);
  }
  return out;
}

export function setPieceFlags(p: PlayerCoreRow): SetPieceFlags {
  const pen = p.penalties_order ?? null;
  const fk = p.direct_freekicks_order ?? null;
  const corn = p.corners_and_indirect_freekicks_order ?? null;
  // inverse: order=1 → 1.0, order=2 → 0.5, order=3 → 0.33, >3 or null → 0
  const w = (o: number | null) => (o && o >= 1 && o <= 3 ? 1 / o : 0);
  // penalties dominate (huge bonus+xG), FK medium, corners small.
  const score = Math.min(
    1,
    w(pen) * 0.6 + w(fk) * 0.25 + w(corn) * 0.15,
  );
  return { penalties: pen, freekicks: fk, corners: corn, score };
}

/**
 * For each (player, opp_team_id) pair, aggregate historical per-GW rows from
 * `player_gw_stats` where the player faced that opponent. Returns a nested
 * Map: playerId -> (oppTeamId -> OpponentHistory).
 */
export async function loadOpponentHistory(
  playerIds: number[],
  oppTeamIds: number[],
): Promise<Map<number, Map<number, OpponentHistory>>> {
  const out = new Map<number, Map<number, OpponentHistory>>();
  if (playerIds.length === 0 || oppTeamIds.length === 0) return out;
  const supa = getServerSupabase();
  const { data } = await supa
    .from("player_gw_stats")
    .select(
      "player_id,opponent_team_id,minutes,total_points,goals_scored,assists",
    )
    .in("player_id", playerIds)
    .in("opponent_team_id", oppTeamIds);

  for (const pid of playerIds) out.set(pid, new Map());
  for (const r of data ?? []) {
    const pid = r.player_id as number;
    const opp = r.opponent_team_id as number | null;
    if (opp == null) continue;
    const inner = out.get(pid)!;
    const agg: OpponentHistory =
      inner.get(opp) ??
      { games: 0, minutes: 0, points: 0, goals: 0, assists: 0, ppg: null };
    const mins = num(r.minutes);
    if (mins > 0) agg.games += 1;
    agg.minutes += mins;
    agg.points += num(r.total_points);
    agg.goals += num(r.goals_scored);
    agg.assists += num(r.assists);
    agg.ppg = agg.games > 0 ? agg.points / agg.games : null;
    inner.set(opp, agg);
  }
  return out;
}

/**
 * Aggregate last ROLLING_WINDOW gameweeks of per-GW stats for each player.
 * Returns summed values (minutes, xG, xA, bonus, bps, saves, etc).
 */
export async function loadRollingStats(
  ids: number[],
  currentGw: number,
  window = ROLLING_WINDOW,
): Promise<Map<number, PlayerRolling>> {
  const out = new Map<number, PlayerRolling>();
  if (ids.length === 0) return out;
  const fromGw = Math.max(1, currentGw - window + 1);
  const supa = getServerSupabase();
  // Try the full defensive-enhanced column set first; fall back to the
  // legacy set if migration 0003 hasn't landed yet.
  const FULL_COLS =
    "player_id,gw,minutes,goals_scored,assists,clean_sheets,goals_conceded,saves,bonus,bps,expected_goals,expected_assists,expected_goal_involve,expected_goals_conceded,total_points,clearances_blocks_interceptions,recoveries,tackles,defensive_contribution,starts";
  const LEGACY_COLS =
    "player_id,gw,minutes,goals_scored,assists,clean_sheets,goals_conceded,saves,bonus,bps,expected_goals,expected_assists,expected_goal_involve,expected_goals_conceded,total_points";
  const first = await supa
    .from("player_gw_stats")
    .select(FULL_COLS)
    .in("player_id", ids)
    .gte("gw", fromGw)
    .lte("gw", currentGw);
  let data = first.data as unknown as Array<Record<string, unknown>> | null;
  if (first.error) {
    const fallback = await supa
      .from("player_gw_stats")
      .select(LEGACY_COLS)
      .in("player_id", ids)
      .gte("gw", fromGw)
      .lte("gw", currentGw);
    data = fallback.data as unknown as Array<Record<string, unknown>> | null;
  }

  for (const id of ids) {
    out.set(id, emptyRolling(currentGw - fromGw + 1));
  }

  for (const r of data ?? []) {
    const pid = Number(r.player_id);
    const agg = out.get(pid);
    if (!agg) continue;
    const mins = num(r.minutes);
    agg.minutes += mins;
    if (mins > 0) agg.apps += 1;
    // "start" is the FPL-defined start flag if available, else a proxy.
    const startsField = r.starts;
    if (startsField != null) {
      agg.starts += num(startsField);
    } else if (mins >= 60) {
      agg.starts += 1;
    }
    agg.xg += num(r.expected_goals);
    agg.xa += num(r.expected_assists);
    agg.xgi += num(r.expected_goal_involve);
    agg.xgc += num(r.expected_goals_conceded);
    agg.goals += num(r.goals_scored);
    agg.assists += num(r.assists);
    agg.cs += num(r.clean_sheets);
    agg.gc += num(r.goals_conceded);
    agg.bonus += num(r.bonus);
    agg.bps += num(r.bps);
    agg.saves += num(r.saves);
    agg.points += num(r.total_points);
    agg.cbi += num(r.clearances_blocks_interceptions);
    agg.tackles += num(r.tackles);
    agg.recoveries += num(r.recoveries);
    const dc = num(r.defensive_contribution);
    agg.dc_points += dc;
    if (dc > 0) agg.dc_games += 1;
  }

  return out;
}

export function emptyRolling(windowGws: number): PlayerRolling {
  return {
    window_gws: windowGws,
    minutes: 0,
    starts: 0,
    apps: 0,
    xg: 0,
    xa: 0,
    xgi: 0,
    xgc: 0,
    goals: 0,
    assists: 0,
    cs: 0,
    gc: 0,
    bonus: 0,
    bps: 0,
    saves: 0,
    points: 0,
    cbi: 0,
    tackles: 0,
    recoveries: 0,
    dc_points: 0,
    dc_games: 0,
  };
}

// --- availability ----------------------------------------------------------

function availabilityMultiplier(p: PlayerCoreRow): {
  mult: number;
  note: string | null;
} {
  const status = p.status ?? "a";
  const cop = p.chance_of_playing;
  if (status === "u") return { mult: 0, note: "unavailable (transferred)" };
  if (status === "n") return { mult: 0, note: "not in squad / ineligible" };
  if (status === "s") return { mult: 0, note: "suspended" };
  if (status === "i") {
    const m = cop == null ? 0 : cop / 100;
    return { mult: m, note: `injured (${cop ?? 0}% chance)` };
  }
  if (status === "d" || (typeof cop === "number" && cop < 100)) {
    const m = cop == null ? 0.75 : cop / 100;
    return { mult: m, note: `doubtful (${cop ?? "?"}% chance)` };
  }
  return { mult: 1, note: null };
}

// --- expected minutes ------------------------------------------------------

function expectedMinutes(roll: PlayerRolling, avail: number): number {
  if (roll.window_gws === 0) return 0;
  const apps = Math.max(roll.apps, 0);
  if (apps === 0) return 0;
  // average minutes when the player DID feature
  const minsPerApp = roll.minutes / apps;
  // probability they feature at all = apps / window_gws
  const pFeature = clamp(apps / roll.window_gws, 0, 1);
  return minsPerApp * pFeature * avail;
}

// --- team-level xG engine --------------------------------------------------

function teamGoalsFor(
  team: TeamStrength,
  opp: TeamStrength,
  isHome: boolean,
): number {
  const base = isHome ? HOME_BASE_GOALS : AWAY_BASE_GOALS;
  const atk = isHome ? team.attack_home : team.attack_away;
  const def = isHome ? opp.defence_away : opp.defence_home;
  const mult = (atk / STRENGTH_BASELINE) * (STRENGTH_BASELINE / def);
  return base * clamp(mult, 0.3, 3.0);
}

function teamGoalsAgainst(
  team: TeamStrength,
  opp: TeamStrength,
  isHome: boolean,
): number {
  // "against us" = opponent's expected goals FOR, computed with their role
  return teamGoalsFor(opp, team, !isHome);
}

// --- per-player projection -------------------------------------------------

export function projectPlayerForFixture(args: {
  player: PlayerCoreRow;
  roll: PlayerRolling;
  myTeam: TeamStrength;
  oppTeam: TeamStrength;
  fixture: Fixture;
  availability: number;
  setPieces?: SetPieceFlags;
  oppHistory?: OpponentHistory | null;
  seasonPpg?: number | null;
}): FixtureProjection {
  const {
    player,
    roll,
    myTeam,
    oppTeam,
    fixture,
    availability,
    setPieces,
    oppHistory,
    seasonPpg,
  } = args;
  const isHome = fixture.home_team_id === myTeam.id;
  const position = player.position ?? "MID";

  // expected playing time
  const expMins = expectedMinutes(roll, availability);
  const pAppear = expMins > 0 ? clamp(roll.apps / roll.window_gws, 0, 1) * availability : 0;
  const p60 = expMins >= 60 ? clamp(roll.starts / Math.max(roll.window_gws, 1), 0, 1) * availability : 0;
  const minutesFactor = expMins / 90;

  // team xG for/against this fixture
  const teamGF = teamGoalsFor(myTeam, oppTeam, isHome);
  const teamGA = teamGoalsAgainst(myTeam, oppTeam, isHome);

  // Clean-sheet probability (needed early for defender bonus context).
  const pCS = poissonP0(teamGA);

  // fixture-level multiplier for attacking output (blend team xGF vs a
  // neutral ~1.3 league average). Capped so premium FWD xP doesn't dominate DEF.
  const atkContext = clamp(teamGF / 1.3, 0.4, ATK_CONTEXT_CAP);

  // per-90 rates, with smoothing from season totals when the recent window
  // is too thin.
  const seasonMins = num(player.minutes);
  const xgPer90Recent =
    roll.minutes > 0 ? (roll.xg / roll.minutes) * 90 : 0;
  const xaPer90Recent =
    roll.minutes > 0 ? (roll.xa / roll.minutes) * 90 : 0;
  const xgPer90Season =
    seasonMins > 0 ? (num(player.expected_goals) / seasonMins) * 90 : 0;
  const xaPer90Season =
    seasonMins > 0 ? (num(player.expected_assists) / seasonMins) * 90 : 0;

  // weight: give recent form 70%, season 30% (season anchors low-sample
  // players, recent captures form shifts).
  const xgPer90 = 0.7 * xgPer90Recent + 0.3 * xgPer90Season;
  const xaPer90 = 0.7 * xaPer90Recent + 0.3 * xaPer90Season;

  // Opponent-specific history adjustment (small, capped ±20%).
  // If the player has ≥3 games vs this opponent and his PPG there differs
  // meaningfully from his season PPG, nudge xG/xA accordingly.
  let oppMult = 1;
  if (
    oppHistory &&
    oppHistory.games >= 3 &&
    oppHistory.ppg != null &&
    seasonPpg != null &&
    seasonPpg > 0
  ) {
    const raw = oppHistory.ppg / seasonPpg;
    oppMult = clamp(raw, 0.8, 1.2);
  }

  // Set-piece uplift. Penalty taker → up to +8% xG (pen xG partly in base xG
  // already, small extra reward for consistency/bonus). FK/corners → small
  // xA uplift.
  const spScore = setPieces?.score ?? 0;
  const spMultXG = 1 + 0.08 * (setPieces?.penalties === 1 ? 1 : 0);
  const spMultXA = 1 + 0.05 * spScore;

  const xG = xgPer90 * minutesFactor * atkContext * oppMult * spMultXG;
  const xA = xaPer90 * minutesFactor * atkContext * oppMult * spMultXA;

  const goalPts = GOAL_POINTS[position] ?? 4;
  const xp_goals = xG * goalPts;
  const xp_assists = xA * 3;

  // appearance points: 1 for any appearance, +1 for 60+
  const xp_appearance = pAppear * 1 + p60 * 1;

  const csPts = CS_POINTS[position] ?? 0;
  const xp_cs = pCS * csPts;

  // goals conceded: only GKP/DEF get -1 per 2 conceded
  // expected -points = -0.5 * expected goals conceded while on pitch
  let xp_gc = 0;
  if (position === "GKP" || position === "DEF") {
    const egcOnPitch = teamGA * minutesFactor;
    xp_gc = -0.5 * egcOnPitch;
  }

  // saves: only GKP, 1 per 3 saves
  let xp_saves = 0;
  if (position === "GKP") {
    const savesPer90 =
      roll.minutes > 0 ? (roll.saves / roll.minutes) * 90 : 0;
    xp_saves = (savesPer90 * minutesFactor) / 3;
  }

  // Defensive Contribution (2025/26 FPL rule):
  //  - DEF & GKP: 10+ CBIT (clearances, blocks, interceptions, tackles) → 2 pts
  //  - MID & FWD: 12+ CBIRT (same + recoveries) → 2 pts
  // We model E[DC pts] = 2 * P(X ≥ threshold) where X ~ Poisson(λ) and λ
  // is the expected defensive-action count given minutes and fixture context.
  // Defensive work scales ~linearly with how much attack the player's team
  // faces (proxy: teamGA / league-average ≈ 1.3).
  const isDefender = position === "DEF" || position === "GKP";
  const dcThreshold = isDefender ? 10 : 12;
  let actionsPer90 = 0;
  if (roll.minutes > 0) {
    const cbit = roll.cbi + roll.tackles;
    const cbirt = cbit + roll.recoveries;
    actionsPer90 = ((isDefender ? cbit : cbirt) / roll.minutes) * 90;
  }
  // Season fallback when rolling window is thin.
  const seasonActions = isDefender
    ? num(player.clearances_blocks_interceptions) + num(player.tackles)
    : num(player.clearances_blocks_interceptions) +
      num(player.tackles) +
      num(player.recoveries);
  const actionsPer90Season =
    seasonMins > 0 ? (seasonActions / seasonMins) * 90 : 0;
  const actionsPer90Blend =
    roll.minutes >= 270
      ? 0.7 * actionsPer90 + 0.3 * actionsPer90Season
      : 0.4 * actionsPer90 + 0.6 * actionsPer90Season;

  // Fixture context: more defensive work expected when facing higher xGA.
  const defCtx = clamp(teamGA / 1.3, 0.55, 1.8);

  // DC λ slight boost: Poisson tail was a touch conservative vs observed DC rates.
  const dcLambdaBoost =
    position === "GKP" || position === "DEF"
      ? 1.09
      : position === "MID"
        ? 1.025
        : 1.018;

  const lambdaActions =
    actionsPer90Blend * minutesFactor * defCtx * dcLambdaBoost;
  const pDC = poissonUpperCdf(lambdaActions, dcThreshold);
  const xp_dc = 2 * pDC;

  // Bonus: role-aware — DEF/GKP use CS / concession profile, not atkContext alone.
  const bonusPer90 =
    roll.minutes > 0 ? (roll.bonus / roll.minutes) * 90 : 0;
  const bonusMult = bonusContextMultiplier(position, atkContext, pCS, teamGA);
  const xp_bonus = bonusPer90 * minutesFactor * bonusMult;

  const posCal = positionCalibration(position);
  const xp_appearance_c = xp_appearance * posCal;
  const xp_goals_c = xp_goals * posCal;
  const xp_assists_c = xp_assists * posCal;
  const xp_cs_c = xp_cs * posCal;
  const xp_gc_c = xp_gc * posCal;
  const xp_saves_c = xp_saves * posCal;
  const xp_dc_c = xp_dc * posCal;
  const xp_bonus_c = xp_bonus * posCal;

  const xp_total =
    xp_appearance_c +
    xp_goals_c +
    xp_assists_c +
    xp_cs_c +
    xp_gc_c +
    xp_saves_c +
    xp_dc_c +
    xp_bonus_c;

  return {
    gw: fixture.gw,
    fixture_id: fixture.id,
    opp_team_id: oppTeam.id,
    opp_short: oppTeam.short,
    home: isHome,
    fdr: isHome ? fixture.home_fdr : fixture.away_fdr,
    expected_minutes: round(expMins, 1),
    p_appear: round(pAppear, 3),
    p_60plus: round(p60, 3),
    team_xg_for: round(teamGF, 2),
    team_xg_against: round(teamGA, 2),
    p_clean_sheet: round(pCS, 3),
    opp_history: oppHistory ?? null,
    opp_history_mult: round(oppMult, 3),
    xG: round(xG, 3),
    xA: round(xA, 3),
    exp_defensive_actions: round(lambdaActions, 2),
    dc_threshold: dcThreshold,
    p_dc: round(pDC, 3),
    xp_appearance: round(xp_appearance_c, 2),
    xp_goals: round(xp_goals_c, 2),
    xp_assists: round(xp_assists_c, 2),
    xp_cs: round(xp_cs_c, 2),
    xp_gc: round(xp_gc_c, 2),
    xp_saves: round(xp_saves_c, 2),
    xp_dc: round(xp_dc_c, 2),
    xp_bonus: round(xp_bonus_c, 2),
    xp_total: round(xp_total, 2),
  };
}

// --- batch projection ------------------------------------------------------

export interface ProjectOptions {
  currentGw: number;
  fromGw: number;
  toGw: number;
}

export async function projectPlayers(
  playerIds: number[],
  opts: ProjectOptions,
): Promise<Map<number, PlayerProjection>> {
  const out = new Map<number, PlayerProjection>();
  if (playerIds.length === 0) return out;

  const [teams, fixtures, players, rollingAll] = await Promise.all([
    loadTeams(),
    loadFixturesWindow(opts.fromGw, opts.toGw),
    loadPlayers(playerIds),
    loadRollingStats(playerIds, opts.currentGw),
  ]);

  // group fixtures by team (unfinished only)
  const fixturesByTeam = new Map<number, Fixture[]>();
  const oppIdsSet = new Set<number>();
  for (const f of fixtures) {
    if (f.finished) continue;
    for (const tid of [f.home_team_id, f.away_team_id]) {
      if (!fixturesByTeam.has(tid)) fixturesByTeam.set(tid, []);
      fixturesByTeam.get(tid)!.push(f);
    }
  }

  // Build the list of opponent team IDs each player will face, for the
  // opponent-history batch load.
  for (const pid of playerIds) {
    const p = players.get(pid);
    if (!p || p.team_id == null) continue;
    const fxs = fixturesByTeam.get(p.team_id) ?? [];
    for (const f of fxs) {
      const oppId =
        f.home_team_id === p.team_id ? f.away_team_id : f.home_team_id;
      oppIdsSet.add(oppId);
    }
  }
  const oppHistoryByPlayer = await loadOpponentHistory(
    playerIds,
    Array.from(oppIdsSet),
  );

  for (const pid of playerIds) {
    const p = players.get(pid);
    if (!p || p.team_id == null) continue;
    const myTeam = teams.get(p.team_id);
    if (!myTeam) continue;
    const { mult: avail, note } = availabilityMultiplier(p);
    const roll = rollingAll.get(pid) ?? emptyRolling(0);
    const sp = setPieceFlags(p);
    const seasonPpg = p.points_per_game != null ? Number(p.points_per_game) : null;

    const teamFixtures = fixturesByTeam.get(p.team_id) ?? [];
    const projections: FixtureProjection[] = [];
    for (const f of teamFixtures) {
      const oppId =
        f.home_team_id === p.team_id ? f.away_team_id : f.home_team_id;
      const oppTeam = teams.get(oppId);
      if (!oppTeam) continue;
      const hist = oppHistoryByPlayer.get(pid)?.get(oppId) ?? null;
      projections.push(
        projectPlayerForFixture({
          player: p,
          roll,
          myTeam,
          oppTeam,
          fixture: f,
          availability: avail,
          setPieces: sp,
          oppHistory: hist && hist.games > 0 ? hist : null,
          seasonPpg,
        }),
      );
    }

    const xpTotal = projections.reduce((s, f) => s + f.xp_total, 0);
    const games = projections.length;
    const price = p.base_price != null ? Number(p.base_price) : null;

    out.set(pid, {
      fpl_id: pid,
      web_name: p.web_name,
      team: p.team,
      team_id: p.team_id,
      position: p.position,
      price,
      form: p.form != null ? Number(p.form) : null,
      ownership: p.selected_by_percent != null ? Number(p.selected_by_percent) : null,
      availability: avail,
      availability_note: note,
      set_pieces: sp,
      rolling: roll,
      fixtures: projections,
      xp_total: round(xpTotal, 2),
      xp_per_game: games > 0 ? round(xpTotal / games, 2) : 0,
      value_per_million:
        price && price > 0 ? round(xpTotal / price, 3) : null,
    });
  }

  return out;
}

/**
 * Resolve the current and next relevant gameweeks from the DB.
 * Returns: { current, next, finishedCount }
 */
export async function resolveCurrentGw(): Promise<{
  current: number;
  next: number;
}> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("gameweeks")
    .select("id,is_current,is_next,finished")
    .order("id", { ascending: true });
  const rows = data ?? [];
  const cur = rows.find((g) => g.is_current) ?? rows.find((g) => g.is_next);
  if (cur) {
    const id = cur.id as number;
    return { current: id, next: id + 1 };
  }
  const lastFinished = [...rows].reverse().find((g) => g.finished);
  const c = ((lastFinished?.id as number | undefined) ?? 0) + 1;
  return { current: c, next: c + 1 };
}

export const XP_SCORING_NOTE =
  "xP = attacking (Poisson team xG + rolling per-90 xG/xA; fixture attack context capped) + appearance + clean-sheet + goals conceded + saves + defensive-contribution (Poisson vs FPL DC thresholds; λ boosted slightly for DEF/GK) + bonus per 90. Bonus for DEF/GK uses CS probability + concession profile, not team xGF alone (aligns BPS with defensive fixtures). Light position calibration (DEF/GKP slightly up, FWD slightly down) for realistic starter bands. Rolling 6-GW 70/30 season blend. Opponent history ±20% on xG/xA. Set-piece / availability as before.";

// --- EO / ownership-aware captain ranking ----------------------------------

/**
 * Adjust xP for a risk mode. `chase` subtracts an ownership penalty so
 * low-owned picks rise up (rank climb). `protect` gives a small nudge
 * toward template picks (so you don't miss out on popular hauls).
 */
export function riskAdjustedXP(
  xp: number,
  ownership: number | null,
  mode: "neutral" | "chase" | "protect" = "neutral",
): number {
  if (mode === "neutral") return xp;
  const own = ownership ?? 0;
  if (mode === "chase") {
    // penalty scales up to ~1.2 xP off for a 60%-owned player
    return xp - Math.min(own / 50, 1.2);
  }
  // protect: small uplift up to ~0.6 for 60%+ owned template picks
  return xp + Math.min(own / 100, 0.6);
}
