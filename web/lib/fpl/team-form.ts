/**
 * Club-level form for FPL projections.
 *
 * Player xP used to scale only on FPL's static team strength. This module
 * adds rolling club xG / xGA / CS luck and a shared attack pie so teammates
 * move together and a leaky defence is not treated as a CS asset.
 */
import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";

export const TEAM_FORM_WINDOW = 6;
/** Weight of observed club rates vs FPL strength (0 = strength only). */
export const TEAM_FORM_BLEND = 0.42;
/** Mix player rate xG with team-xG × share-of-attack. */
export const ATTACK_PIE_WEIGHT = 0.36;
export const LEAGUE_XG_FALLBACK = 1.35;

export type ClubFormTag =
  | "hot_attack"
  | "cold_attack"
  | "leaky"
  | "solid"
  | "lucky_cs"
  | "neutral";

export type DisciplineRisk = "low" | "med" | "high";

export type ClubForm = {
  team_id: number;
  short: string;
  name: string;
  games: number;
  from_gw: number;
  to_gw: number;
  xg: number;
  xa: number;
  goals: number;
  xga: number;
  gc: number;
  cs: number;
  xg_pg: number;
  xga_pg: number;
  goals_pg: number;
  attack_form: number;
  defence_leak: number;
  luck_goals: number;
  luck_cs: number;
  attack_mult: number;
  defence_mult: number;
  missing_attack: number;
  missing_note: string | null;
  tag: ClubFormTag;
  def_use: "cs" | "dc" | "mixed";
  yellows: number;
  reds: number;
  def_yellows: number;
  def_reds: number;
  cards_pg: number;
  discipline_risk: DisciplineRisk;
  risk_partners: string[];
};

export type ClubAdvice = {
  team_id: number;
  short: string;
  name: string;
  tag: ClubFormTag;
  def_use: ClubForm["def_use"];
  attack_form: number;
  defence_leak: number;
  luck_cs: number;
  discipline_risk: DisciplineRisk;
  risk_partners: string[];
  missing_note: string | null;
  fit: number;
};

export type ClubFormBundle = {
  fromGw: number;
  throughGw: number;
  league_xg_pg: number;
  league_xga_pg: number;
  clubs: ClubForm[];
  byTeam: Map<number, ClubForm>;
  /** Player share of club season xG (MID/FWD/DEF with minutes). */
  xgShare: Map<number, number>;
  xaShare: Map<number, number>;
};

export function emptyClubFormBundle(): ClubFormBundle {
  return {
    fromGw: 0,
    throughGw: 0,
    league_xg_pg: LEAGUE_XG_FALLBACK,
    league_xga_pg: LEAGUE_XG_FALLBACK,
    clubs: [],
    byTeam: new Map(),
    xgShare: new Map(),
    xaShare: new Map(),
  };
}

type TeamInfo = { id: number; short: string; name: string };

type PlayerRow = {
  fpl_id: number;
  team_id: number | null;
  position: string | null;
  web_name: string | null;
  minutes: number;
  xg: number;
  xa: number;
  xgi: number;
  pen_order: number | null;
  status: string | null;
  chance: number | null;
};

type GwAgg = {
  xg: number;
  xa: number;
  goals: number;
  opp: number | null;
  gk_cs: number;
  gk_gc: number;
  gk_mins: number;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(n: number, d = 3): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function isUnavailable(p: PlayerRow): boolean {
  const st = (p.status ?? "").toLowerCase();
  if (st === "i" || st === "s" || st === "u") return true;
  if (p.chance != null && Number.isFinite(p.chance) && p.chance < 50) return true;
  return false;
}

export function formTag(c: {
  attack_form: number;
  defence_leak: number;
  luck_cs: number;
}): ClubFormTag {
  if (c.luck_cs >= 0.22 && c.defence_leak >= 0.98) return "lucky_cs";
  if (c.defence_leak >= 1.18) return "leaky";
  if (c.attack_form >= 1.16) return "hot_attack";
  if (c.attack_form <= 0.86) return "cold_attack";
  if (c.defence_leak <= 0.9) return "solid";
  return "neutral";
}

export function defUseFromLeak(defence_leak: number, luck_cs: number): ClubForm["def_use"] {
  if (defence_leak >= 1.12) return "dc";
  if (defence_leak <= 0.92) return "cs";
  if (luck_cs >= 0.22) return "dc";
  return "mixed";
}

export function blendFixtureLambdas(
  strengthGF: number,
  strengthGA: number,
  my: ClubForm | null | undefined,
  opp: ClubForm | null | undefined,
): { teamGF: number; teamGA: number } {
  if (!my || my.games <= 0) {
    return { teamGF: strengthGF, teamGA: strengthGA };
  }
  const oppAtk = opp && opp.games > 0 ? opp.attack_mult : 1;
  const oppDef = opp && opp.games > 0 ? opp.defence_mult : 1;
  const oppMiss = opp && opp.games > 0 ? opp.missing_attack : 1;
  const oppLuck = opp && opp.games > 0 ? opp.luck_cs : 0;
  const oppLeak = opp && opp.games > 0 ? opp.defence_leak : 1;
  let gf =
    strengthGF * my.attack_mult * oppDef * my.missing_attack;
  let ga =
    strengthGA * oppAtk * my.defence_mult * oppMiss;
  // Only regress "lucky CS" when the defence is not already elite on xGA.
  if (oppLuck > 0.2 && oppLeak >= 0.95) {
    gf *= 1 + 0.08 * clamp(oppLuck / 0.4, 0, 1);
  }
  if (my.luck_cs > 0.2 && my.defence_leak >= 0.95) {
    ga *= 1 + 0.08 * clamp(my.luck_cs / 0.4, 0, 1);
  }
  if (my.discipline_risk === "high") ga *= 1.08;
  else if (my.discipline_risk === "med") ga *= 1.03;
  return {
    teamGF: clamp(gf, 0.25, 3.2),
    teamGA: clamp(ga, 0.25, 3.2),
  };
}

export function mixRateAndPie(rateValue: number, pieValue: number): number {
  return (1 - ATTACK_PIE_WEIGHT) * rateValue + ATTACK_PIE_WEIGHT * pieValue;
}

export function disciplineFromCards(opts: {
  games: number;
  defYellows: number;
  defReds: number;
}): DisciplineRisk {
  const g = Math.max(opts.games, 1);
  const cardsPg = (opts.defYellows + 3 * opts.defReds) / g;
  if (opts.defReds >= 1 || cardsPg >= 2.2) return "high";
  if (opts.defYellows >= 4 || cardsPg >= 1.4) return "med";
  return "low";
}

/**
 * Extra multiplier on a player's xP when ranking transfers.
 * Leaky / card-prone backlines are not interchangeable with a CS defender.
 */
export function transferClubFit(
  position: string | null | undefined,
  club: ClubForm | null | undefined,
): number {
  if (!club || club.games <= 0) return 1;
  const pos = (position ?? "").toUpperCase();
  if (pos === "DEF" || pos === "GKP") {
    let m = 1;
    if (club.def_use === "dc") m *= 0.78;
    else if (club.def_use === "mixed") m *= 0.92;
    if (club.discipline_risk === "high") m *= 0.84;
    else if (club.discipline_risk === "med") m *= 0.93;
    return clamp(m, 0.6, 1);
  }
  if (pos === "MID" || pos === "FWD") {
    let m = 0.62 + 0.38 * club.attack_form;
    m *= club.missing_attack;
    return clamp(m, 0.7, 1.18);
  }
  return 1;
}

export function clubAdviceFor(
  club: ClubForm | null | undefined,
  position: string | null | undefined,
): ClubAdvice | null {
  if (!club || club.games <= 0) return null;
  return {
    team_id: club.team_id,
    short: club.short,
    name: club.name,
    tag: club.tag,
    def_use: club.def_use,
    attack_form: club.attack_form,
    defence_leak: club.defence_leak,
    luck_cs: club.luck_cs,
    discipline_risk: club.discipline_risk,
    risk_partners: club.risk_partners,
    missing_note: club.missing_note,
    fit: transferClubFit(position, club),
  };
}

export function formatClubAdviceZh(a: ClubAdvice, position?: string | null): string {
  const pos = (position ?? "").toUpperCase();
  const defUse =
    a.def_use === "cs"
      ? "后卫可当零封资产"
      : a.def_use === "dc"
        ? "后卫只看 DefCon / 进攻，不当零封"
        : "后卫零封与 DefCon 都一般";
  const disc =
    a.discipline_risk === "high"
      ? "纪律风险高（中卫红黄牌会直接毁掉边卫零封和球队结构）"
      : a.discipline_risk === "med"
        ? "纪律风险中等（盯后防吃牌）"
        : "纪律风险低";
  const partners = a.risk_partners.length
    ? `高风险队友：${a.risk_partners.join("、")}。`
    : "";
  const miss = a.missing_note ? `缺员：${a.missing_note}。` : "";
  if (pos === "DEF" || pos === "GKP") {
    return `${a.short} 场均 xGA ${a.defence_leak.toFixed(2)}×联盟。${defUse}。${disc}。${partners}${miss}买入此人必须看整条后防，不能只看个人 xP。`;
  }
  return `${a.short} 进攻状态 ${a.attack_form.toFixed(2)}（1.00=联盟均值）。${miss}${partners}个人 xP 要放在整队得分能力里看。`;
}

export function formatClubAdviceEn(a: ClubAdvice, position?: string | null): string {
  const pos = (position ?? "").toUpperCase();
  const defUse =
    a.def_use === "cs"
      ? "DEF/GKP can be CS assets"
      : a.def_use === "dc"
        ? "DEF is DC/attack only — not a CS asset"
        : "CS and DC both mixed";
  const disc =
    a.discipline_risk === "high"
      ? "High card risk (a CB red/booking can wipe a full-back's CS and the team's shape)"
      : a.discipline_risk === "med"
        ? "Medium card risk in the back line"
        : "Low card risk";
  const partners = a.risk_partners.length
    ? `Risky teammates: ${a.risk_partners.join(", ")}. `
    : "";
  const miss = a.missing_note ? `Missing: ${a.missing_note}. ` : "";
  if (pos === "DEF" || pos === "GKP") {
    return `${a.short} xGA ${a.defence_leak.toFixed(2)}× league. ${defUse}. ${disc}. ${partners}${miss}Do not buy on player xP alone — the whole back line matters.`;
  }
  return `${a.short} attack form ${a.attack_form.toFixed(2)} (1.00 = league). ${miss}${partners}Read player xP inside the club's scoring level.`;
}

function finishClub(
  team: TeamInfo,
  fromGw: number,
  toGw: number,
  xg: number,
  xa: number,
  goals: number,
  xga: number,
  gc: number,
  cs: number,
  games: number,
  leagueXg: number,
  leagueXga: number,
  missing: { mult: number; note: string | null },
  discipline: {
    yellows: number;
    reds: number;
    defYellows: number;
    defReds: number;
    partners: string[];
  },
): ClubForm {
  const g = Math.max(games, 1);
  const xg_pg = xg / g;
  const xga_pg = xga / g;
  const goals_pg = goals / g;
  const attack_form = clamp(xg_pg / Math.max(leagueXg, 0.6), 0.72, 1.42);
  const defence_leak = clamp(xga_pg / Math.max(leagueXga, 0.6), 0.72, 1.42);
  const cs_rate = cs / g;
  const luck_cs = cs_rate - Math.exp(-xga_pg);
  const attack_mult = (1 - TEAM_FORM_BLEND) + TEAM_FORM_BLEND * attack_form;
  const defence_mult = (1 - TEAM_FORM_BLEND) + TEAM_FORM_BLEND * defence_leak;
  const cards_pg = (discipline.defYellows + 3 * discipline.defReds) / g;
  const discipline_risk = disciplineFromCards({
    games,
    defYellows: discipline.defYellows,
    defReds: discipline.defReds,
  });
  const base = {
    attack_form,
    defence_leak,
    luck_cs,
  };
  return {
    team_id: team.id,
    short: team.short,
    name: team.name,
    games,
    from_gw: fromGw,
    to_gw: toGw,
    xg: round(xg, 2),
    xa: round(xa, 2),
    goals: round(goals, 2),
    xga: round(xga, 2),
    gc: round(gc, 2),
    cs,
    xg_pg: round(xg_pg, 2),
    xga_pg: round(xga_pg, 2),
    goals_pg: round(goals_pg, 2),
    attack_form: round(attack_form, 3),
    defence_leak: round(defence_leak, 3),
    luck_goals: round(goals - xg, 2),
    luck_cs: round(luck_cs, 3),
    attack_mult: round(attack_mult, 3),
    defence_mult: round(defence_mult, 3),
    missing_attack: round(missing.mult, 3),
    missing_note: missing.note,
    tag: formTag(base),
    def_use: defUseFromLeak(defence_leak, luck_cs),
    yellows: discipline.yellows,
    reds: discipline.reds,
    def_yellows: discipline.defYellows,
    def_reds: discipline.defReds,
    cards_pg: round(cards_pg, 2),
    discipline_risk,
    risk_partners: discipline.partners,
  };
}

function missingAttackForTeam(players: PlayerRow[]): { mult: number; note: string | null } {
  const squad = players.filter((p) => (p.minutes > 0 || p.xgi > 0.4) && p.position !== "GKP");
  if (squad.length === 0) return { mult: 1, note: null };
  const byXgi = [...squad].sort((a, b) => b.xgi - a.xgi);
  const pen = squad.find((p) => p.pen_order === 1) ?? null;
  const star = byXgi[0] ?? null;
  let mult = 1;
  const notes: string[] = [];
  if (star && isUnavailable(star) && star.xgi >= 1.2) {
    mult *= 0.9;
    notes.push(`${star.web_name ?? "star"} out`);
  }
  if (pen && isUnavailable(pen)) {
    mult *= 0.94;
    if (!notes.some((n) => n.startsWith(pen.web_name ?? ""))) {
      notes.push(`pens (${pen.web_name ?? "?"}) out`);
    }
  }
  return { mult: clamp(mult, 0.82, 1), note: notes.length ? notes.join("; ") : null };
}

export async function loadClubFormRaw(opts: {
  throughGw: number;
  window?: number;
  season?: string;
}): Promise<ClubFormBundle> {
  const throughGw = Math.max(0, Math.floor(opts.throughGw));
  const window = Math.min(Math.max(opts.window ?? TEAM_FORM_WINDOW, 1), 10);
  const fromGw = throughGw > 0 ? Math.max(1, throughGw - window + 1) : 0;
  const empty: ClubFormBundle = {
    fromGw,
    throughGw,
    league_xg_pg: LEAGUE_XG_FALLBACK,
    league_xga_pg: LEAGUE_XG_FALLBACK,
    clubs: [],
    byTeam: new Map(),
    xgShare: new Map(),
    xaShare: new Map(),
  };
  if (throughGw < 1) return empty;

  const season = opts.season?.trim() || (await getCurrentFplSeason());
  const supa = getServerSupabase();

  const [{ data: teamRows }, { data: playerRows }] = await Promise.all([
    supa.from("teams").select("id,short_name,name"),
    supa
      .from("players_static")
      .select(
        "fpl_id,team_id,position,web_name,minutes,expected_goals,expected_assists,expected_goal_involve,penalties_order,status,chance_of_playing",
      ),
  ]);

  const teams = new Map<number, TeamInfo>();
  for (const t of teamRows ?? []) {
    teams.set(Number(t.id), {
      id: Number(t.id),
      short: String(t.short_name ?? ""),
      name: String(t.name ?? ""),
    });
  }

  const players: PlayerRow[] = [];
  const playerTeam = new Map<number, number>();
  const byClub = new Map<number, PlayerRow[]>();
  for (const r of playerRows ?? []) {
    const p: PlayerRow = {
      fpl_id: Number(r.fpl_id),
      team_id: r.team_id != null ? Number(r.team_id) : null,
      position: r.position != null ? String(r.position) : null,
      web_name: r.web_name != null ? String(r.web_name) : null,
      minutes: num(r.minutes),
      xg: num(r.expected_goals),
      xa: num(r.expected_assists),
      xgi: num(r.expected_goal_involve),
      pen_order: r.penalties_order != null ? Number(r.penalties_order) : null,
      status: r.status != null ? String(r.status) : null,
      chance: r.chance_of_playing != null ? Number(r.chance_of_playing) : null,
    };
    players.push(p);
    if (p.team_id == null) continue;
    playerTeam.set(p.fpl_id, p.team_id);
    const list = byClub.get(p.team_id) ?? [];
    list.push(p);
    byClub.set(p.team_id, list);
  }

  const gwAgg = new Map<string, GwAgg>();
  const key = (tid: number, gw: number) => `${tid}:${gw}`;
  const posById = new Map(players.map((p) => [p.fpl_id, p.position]));
  const nameById = new Map(players.map((p) => [p.fpl_id, p.web_name ?? `#${p.fpl_id}`]));
  const teamDisc = new Map<
    number,
    { yellows: number; reds: number; defYellows: number; defReds: number }
  >();
  const defCardByPlayer = new Map<
    number,
    { teamId: number; name: string; yel: number; red: number }
  >();

  for (let gw = fromGw; gw <= throughGw; gw++) {
    const { data: statRows } = await supa
      .from("player_gw_stats")
      .select(
        "player_id,gw,minutes,expected_goals,expected_assists,goals_scored,goals_conceded,clean_sheets,opponent_team_id,yellow_cards,red_cards",
      )
      .eq("season", season)
      .eq("gw", gw);

    for (const r of statRows ?? []) {
      const pid = Number(r.player_id);
      const tid = playerTeam.get(pid);
      if (tid == null) continue;
      const mins = num(r.minutes);
      if (mins <= 0) continue;
      const k = key(tid, gw);
      const cur = gwAgg.get(k) ?? {
        xg: 0,
        xa: 0,
        goals: 0,
        opp: r.opponent_team_id != null ? Number(r.opponent_team_id) : null,
        gk_cs: 0,
        gk_gc: 0,
        gk_mins: 0,
      };
      cur.xg += num(r.expected_goals);
      cur.xa += num(r.expected_assists);
      cur.goals += num(r.goals_scored);
      if (r.opponent_team_id != null) cur.opp = Number(r.opponent_team_id);
      const pos = posById.get(pid);
      if (pos === "GKP" && mins >= cur.gk_mins) {
        cur.gk_mins = mins;
        cur.gk_cs = num(r.clean_sheets) > 0 ? 1 : 0;
        cur.gk_gc = num(r.goals_conceded);
      }
      const yel = num(r.yellow_cards);
      const red = num(r.red_cards);
      const disc = teamDisc.get(tid) ?? {
        yellows: 0,
        reds: 0,
        defYellows: 0,
        defReds: 0,
      };
      disc.yellows += yel;
      disc.reds += red;
      if (pos === "DEF" || pos === "GKP") {
        disc.defYellows += yel;
        disc.defReds += red;
        const pc = defCardByPlayer.get(pid) ?? {
          teamId: tid,
          name: nameById.get(pid) ?? `#${pid}`,
          yel: 0,
          red: 0,
        };
        pc.yel += yel;
        pc.red += red;
        defCardByPlayer.set(pid, pc);
      }
      teamDisc.set(tid, disc);
      gwAgg.set(k, cur);
    }
  }

  type Totals = {
    xg: number;
    xa: number;
    goals: number;
    xga: number;
    gc: number;
    cs: number;
    games: number;
  };
  const totals = new Map<number, Totals>();
  for (const [k, agg] of gwAgg) {
    const [tidStr] = k.split(":");
    const tid = Number(tidStr);
    const xga = agg.opp != null ? (gwAgg.get(key(agg.opp, Number(k.split(":")[1])))?.xg ?? 0) : 0;
    const t = totals.get(tid) ?? {
      xg: 0,
      xa: 0,
      goals: 0,
      xga: 0,
      gc: 0,
      cs: 0,
      games: 0,
    };
    t.xg += agg.xg;
    t.xa += agg.xa;
    t.goals += agg.goals;
    t.xga += xga;
    t.gc += agg.gk_gc;
    t.cs += agg.gk_cs;
    t.games += 1;
    totals.set(tid, t);
  }

  const played = [...totals.values()].filter((t) => t.games > 0);
  const leagueXg =
    played.length > 0
      ? played.reduce((s, t) => s + t.xg / t.games, 0) / played.length
      : LEAGUE_XG_FALLBACK;
  const leagueXga =
    played.length > 0
      ? played.reduce((s, t) => s + t.xga / t.games, 0) / played.length
      : LEAGUE_XG_FALLBACK;

  const clubs: ClubForm[] = [];
  const byTeam = new Map<number, ClubForm>();
  for (const team of teams.values()) {
    const t = totals.get(team.id);
    const miss = missingAttackForTeam(byClub.get(team.id) ?? []);
    const d = teamDisc.get(team.id) ?? {
      yellows: 0,
      reds: 0,
      defYellows: 0,
      defReds: 0,
    };
    const partners = [...defCardByPlayer.values()]
      .filter((p) => p.teamId === team.id && (p.red > 0 || p.yel >= 2))
      .sort((a, b) => b.red * 3 + b.yel - (a.red * 3 + a.yel))
      .slice(0, 3)
      .map((p) => {
        const bits = [p.name];
        if (p.red > 0) bits.push(`${p.red}R`);
        if (p.yel > 0) bits.push(`${p.yel}Y`);
        return bits.join(" ");
      });
    const club = finishClub(
      team,
      fromGw,
      throughGw,
      t?.xg ?? 0,
      t?.xa ?? 0,
      t?.goals ?? 0,
      t?.xga ?? 0,
      t?.gc ?? 0,
      t?.cs ?? 0,
      t?.games ?? 0,
      leagueXg,
      leagueXga,
      miss,
      {
        yellows: d.yellows,
        reds: d.reds,
        defYellows: d.defYellows,
        defReds: d.defReds,
        partners,
      },
    );
    clubs.push(club);
    byTeam.set(team.id, club);
  }
  clubs.sort((a, b) => b.xg_pg - a.xg_pg);

  const xgShare = new Map<number, number>();
  const xaShare = new Map<number, number>();
  for (const [tid, squad] of byClub) {
    const attackers = squad.filter(
      (p) => p.position !== "GKP" && (p.minutes > 0 || p.xg > 0.05 || p.xa > 0.05),
    );
    const xgSum = attackers.reduce((s, p) => s + p.xg, 0);
    const xaSum = attackers.reduce((s, p) => s + p.xa, 0);
    for (const p of attackers) {
      if (xgSum > 0.05) xgShare.set(p.fpl_id, p.xg / xgSum);
      if (xaSum > 0.05) xaShare.set(p.fpl_id, p.xa / xaSum);
    }
  }

  return {
    fromGw,
    throughGw,
    league_xg_pg: round(leagueXg, 3),
    league_xga_pg: round(leagueXga, 3),
    clubs,
    byTeam,
    xgShare,
    xaShare,
  };
}

export const loadClubForm = unstable_cache(
  async () => {
    const supa = getServerSupabase();
    const { data } = await supa
      .from("gameweeks")
      .select("id,is_current,is_next,finished")
      .order("id", { ascending: true });
    const rows = data ?? [];
    const current = rows.find((g) => g.is_current) ?? rows.find((g) => g.is_next);
    const currentId = current ? Number(current.id) : 1;
    const currentFinished = Boolean(current?.finished);
    const throughGw = currentFinished ? currentId : Math.max(1, currentId - 1);
    return loadClubFormRaw({ throughGw });
  },
  ["fpl-club-form-v2"],
  { revalidate: 120 },
);
