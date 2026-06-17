import { getServerSupabase } from "@/lib/supabase";
import {
  loadFifaPlayerProfiles,
  loadFifaSquads,
  squadCodeToGroup,
  type FifaPlayerProfile,
} from "@/lib/wc/fifa-data";
import {
  isWcMatchFinished,
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";
import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";

export const MATCH_ENRICHMENT_VERSION = "v4";

export type SummaryLocale = "en" | "zh";

type TeamStanding = {
  code: string;
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
};

type WcPlayerSnippet = {
  fifa_element_id: number;
  name: string;
  position: string;
  season_club: string | null;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
};

export type MatchEnrichment = {
  version: string;
  stageLabel: string;
  groupLetter: string | null;
  matchDetail: string;
  homeForm: string;
  awayForm: string;
  groupTable: string | null;
  homeStandingLine: string | null;
  awayStandingLine: string | null;
  scorerLines: string[];
  fingerprintExtra: string;
};

const CODE_TO_GROUP = new Map(
  WC_GROUP_TEAMS.map((t) => [t.code, t.group]),
);

function groupForTeam(code: string, squadGroups: Map<string, string>): string | null {
  return squadGroups.get(code) ?? CODE_TO_GROUP.get(code) ?? null;
}

function stageDisplay(
  stage: string | null,
  roundId: number,
  locale: SummaryLocale,
): string {
  const s = (stage ?? "").toUpperCase();
  if (locale === "zh") {
    if (s === "GROUP") return `小组赛第${roundId}轮`;
    if (s === "R32") return "32强";
    if (s === "R16") return "16强";
    if (s === "QF") return "四分之一决赛";
    if (s === "SF") return "半决赛";
    if (s === "F") return "决赛";
    return s ? `第${roundId}轮` : `第${roundId}轮`;
  }
  if (s === "GROUP") return `Group stage (${roundId <= 3 ? `MD${roundId}` : "MD" + roundId})`;
  if (s === "R32") return "Round of 32";
  if (s === "R16") return "Round of 16";
  if (s === "QF") return "Quarter-final";
  if (s === "SF") return "Semi-final";
  if (s === "F") return "Final";
  return s || `Round ${roundId}`;
}

export function roundLabelForLocale(
  match: Pick<WcMatchRow, "round_id" | "round_label">,
  locale: SummaryLocale,
): string {
  if (locale === "zh") {
    if (match.round_id <= 3) return `小组赛第${match.round_id}轮`;
    if (match.round_id === 8) return "决赛";
    if (match.round_id === 7) return "半决赛";
    if (match.round_id === 6) return "四分之一决赛";
    if (match.round_id === 5) return "16强";
    if (match.round_id === 4) return "32强";
    return `第${match.round_id}轮`;
  }
  return match.round_label;
}

function positionLabel(pos: string, locale: SummaryLocale): string {
  if (locale === "en") return pos;
  const u = pos.toUpperCase();
  if (u === "FWD" || u.includes("FOR")) return "前锋";
  if (u === "DEF") return "后卫";
  if (u === "MID") return "中场";
  if (u === "GKP" || u === "GK") return "门将";
  return pos;
}

function formatMatchDetail(match: WcMatchRow, locale: SummaryLocale): string {
  const parts: string[] = [];
  if (match.period) {
    const period = match.period.replace(/_/g, " ");
    parts.push(locale === "zh" ? `阶段：${period}` : `Period: ${period}`);
  }
  if (match.minutes > 0) {
    const clock =
      match.extra_minutes > 0
        ? locale === "zh"
          ? `${match.minutes} 分钟（补时 ${match.extra_minutes} 分钟）`
          : `${match.minutes} min (+${match.extra_minutes} added time)`
        : locale === "zh"
          ? `${match.minutes} 分钟`
          : `${match.minutes} min`;
    parts.push(locale === "zh" ? `比赛时长：${clock}` : `Played ${clock}`);
  }
  const hp = match.home_penalty_score;
  const ap = match.away_penalty_score;
  if (
    (hp != null && hp > 0) ||
    (ap != null && ap > 0) ||
    match.period?.includes("penalt")
  ) {
    parts.push(
      locale === "zh"
        ? `点球：${match.home_name} ${hp ?? 0} - ${ap ?? 0} ${match.away_name}`
        : `Penalties: ${match.home_name} ${hp ?? 0} - ${ap ?? 0} ${match.away_name}`,
    );
  }
  return parts.join(locale === "zh" ? "；" : "; ") || (locale === "zh" ? "全场结束" : "Full time");
}

function isBeforeMatch(a: WcMatchRow, b: WcMatchRow): boolean {
  if (a.id === b.id) return false;
  const ta = a.kickoff ? Date.parse(a.kickoff) : 0;
  const tb = b.kickoff ? Date.parse(b.kickoff) : 0;
  if (ta && tb) return ta < tb;
  return a.round_id < b.round_id || (a.round_id === b.round_id && a.id < b.id);
}

function teamResultsBefore(
  code: string,
  match: WcMatchRow,
  allMatches: WcMatchRow[],
  locale: SummaryLocale,
): string {
  const prior = allMatches
    .filter(
      (m) =>
        isWcMatchFinished(m) &&
        isBeforeMatch(m, match) &&
        (m.home_code === code || m.away_code === code),
    )
    .sort((a, b) => {
      const ta = a.kickoff ? Date.parse(a.kickoff) : 0;
      const tb = b.kickoff ? Date.parse(b.kickoff) : 0;
      return ta - tb || a.id - b.id;
    });

  if (!prior.length) {
    return locale === "zh" ? "本届世界杯首秀" : "Opening match of the tournament";
  }

  const tokens: string[] = [];
  let w = 0;
  let d = 0;
  let l = 0;

  for (const m of prior) {
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const home = m.home_code === code;
    const gf = home ? hs : as;
    const ga = home ? as : hs;
    const opp = home ? m.away_name : m.home_name;
    if (gf > ga) {
      tokens.push(
        locale === "zh"
          ? `${gf}-${ga} 胜 ${opp}`
          : `W ${gf}-${ga} vs ${opp}`,
      );
      w++;
    } else if (gf < ga) {
      tokens.push(
        locale === "zh"
          ? `${gf}-${ga} 负 ${opp}`
          : `L ${gf}-${ga} vs ${opp}`,
      );
      l++;
    } else {
      tokens.push(
        locale === "zh"
          ? `${gf}-${ga} 平 ${opp}`
          : `D ${gf}-${ga} vs ${opp}`,
      );
      d++;
    }
  }

  if (locale === "zh") {
    return `${tokens.join("；")}（赛前 ${w} 胜 ${d} 平 ${l} 负）`;
  }
  return `${tokens.join("; ")} (${w}W ${d}D ${l}L before this game)`;
}

function ensureStanding(
  map: Map<string, TeamStanding>,
  code: string,
  name: string,
): TeamStanding {
  let row = map.get(code);
  if (!row) {
    row = {
      code,
      name,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    };
    map.set(code, row);
  }
  return row;
}

function computeGroupStandings(
  group: string,
  maxRoundId: number,
  squadGroups: Map<string, string>,
  allMatches: WcMatchRow[],
): TeamStanding[] {
  const table = new Map<string, TeamStanding>();

  for (const m of allMatches) {
    if (m.round_id > 3 || m.round_id > maxRoundId) continue;
    if (!isWcMatchFinished(m)) continue;

    const homeGroup = groupForTeam(m.home_code, squadGroups);
    const awayGroup = groupForTeam(m.away_code, squadGroups);
    if (homeGroup !== group || awayGroup !== group) continue;

    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const home = ensureStanding(table, m.home_code, m.home_name);
    const away = ensureStanding(table, m.away_code, m.away_name);

    home.played++;
    away.played++;
    home.gf += hs;
    home.ga += as;
    away.gf += as;
    away.ga += hs;

    if (hs > as) {
      home.won++;
      home.pts += 3;
      away.lost++;
    } else if (as > hs) {
      away.won++;
      away.pts += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.pts++;
      away.pts++;
    }
  }

  for (const row of table.values()) {
    row.gd = row.gf - row.ga;
  }

  return [...table.values()].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name),
  );
}

function formatStandingRow(row: TeamStanding, locale: SummaryLocale): string {
  if (locale === "zh") {
    return `${row.name} ${row.pts} 分（${row.played} 场 ${row.won} 胜 ${row.drawn} 平 ${row.lost} 负，净胜球 ${row.gd >= 0 ? "+" : ""}${row.gd}）`;
  }
  return `${row.name} ${row.pts} pts (${row.played}P ${row.won}W ${row.drawn}D ${row.lost}L, GD ${row.gd >= 0 ? "+" : ""}${row.gd})`;
}

function collectGoalPlayerIds(match: WcMatchRow): number[] {
  const ids = new Set<number>();
  const add = (g: WcMatchGoal) => {
    if (g.fifa_player_id) ids.add(g.fifa_player_id);
    if (g.fifa_assist_id) ids.add(g.fifa_assist_id);
  };
  for (const g of match.home_goals ?? []) add(g);
  for (const g of match.away_goals ?? []) add(g);
  return [...ids];
}

function formatScorerLine(
  g: WcMatchGoal,
  teamName: string,
  roundId: number,
  fifaProfiles: Map<number, FifaPlayerProfile>,
  dbPlayers: Map<number, WcPlayerSnippet>,
  locale: SummaryLocale,
): string {
  const parts: string[] = [`${g.scorer_display}（${teamName}）`];
  const scorerId = g.fifa_player_id;
  const assistId = g.fifa_assist_id;

  const fifa = scorerId ? fifaProfiles.get(scorerId) : undefined;
  const db = scorerId ? dbPlayers.get(scorerId) : undefined;

  const meta: string[] = [];
  if (fifa?.position) meta.push(positionLabel(fifa.position, locale));
  if (db?.season_club) {
    meta.push(locale === "zh" ? `俱乐部：${db.season_club}` : `club: ${db.season_club}`);
  }
  if (db && (db.goals > 0 || db.assists > 0)) {
    meta.push(
      locale === "zh"
        ? `赛季 ${db.goals} 球 ${db.assists} 助`
        : `season ${db.goals}G ${db.assists}A`,
    );
  }
  if (fifa?.roundPoints[String(roundId)] != null) {
    meta.push(
      locale === "zh"
        ? `本轮 Fantasy ${fifa.roundPoints[String(roundId)]} 分`
        : `${fifa.roundPoints[String(roundId)]} FPL pts this MD`,
    );
  }
  if (meta.length) parts.push(`[${meta.join(locale === "zh" ? "，" : ", ")}]`);

  if (g.assist_display) {
    const assistMeta: string[] = [];
    const af = assistId ? fifaProfiles.get(assistId) : undefined;
    const adb = assistId ? dbPlayers.get(assistId) : undefined;
    if (af?.position) assistMeta.push(positionLabel(af.position, locale));
    if (adb?.season_club) {
      assistMeta.push(
        locale === "zh" ? `俱乐部：${adb.season_club}` : `club: ${adb.season_club}`,
      );
    }
    if (af?.roundPoints[String(roundId)] != null) {
      assistMeta.push(
        locale === "zh"
          ? `本轮 Fantasy ${af.roundPoints[String(roundId)]} 分`
          : `${af.roundPoints[String(roundId)]} FPL pts this MD`,
      );
    }
    parts.push(
      assistMeta.length
        ? locale === "zh"
          ? `助攻 ${g.assist_display} [${assistMeta.join("，")}]`
          : `assist ${g.assist_display} [${assistMeta.join(", ")}]`
        : locale === "zh"
          ? `助攻 ${g.assist_display}`
          : `assist ${g.assist_display}`,
    );
  }

  return parts.join(locale === "zh" ? "，" : ", ");
}

async function loadDbPlayerSnippets(
  fifaIds: number[],
): Promise<Map<number, WcPlayerSnippet>> {
  const map = new Map<number, WcPlayerSnippet>();
  if (!fifaIds.length) return map;

  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("wc_players")
      .select(
        "fifa_element_id,name,position,season_club,goals,assists,xg,xa",
      )
      .in("fifa_element_id", fifaIds);
    if (error || !data) return map;

    for (const row of data) {
      const id = row.fifa_element_id as number | null;
      if (id == null) continue;
      map.set(id, {
        fifa_element_id: id,
        name: String(row.name ?? ""),
        position: String(row.position ?? ""),
        season_club: (row.season_club as string | null) ?? null,
        goals: Number(row.goals ?? 0),
        assists: Number(row.assists ?? 0),
        xg: Number(row.xg ?? 0),
        xa: Number(row.xa ?? 0),
      });
    }
  } catch {
    /* optional */
  }
  return map;
}

export async function buildMatchEnrichment(
  match: WcMatchRow,
  allMatches: WcMatchRow[],
  locale: SummaryLocale = "en",
): Promise<MatchEnrichment> {
  const [squads, fifaProfiles] = await Promise.all([
    loadFifaSquads(),
    loadFifaPlayerProfiles(),
  ]);
  const squadGroups = squadCodeToGroup(squads);
  const groupLetter = groupForTeam(match.home_code, squadGroups);

  const playerIds = collectGoalPlayerIds(match);
  const dbPlayers = await loadDbPlayerSnippets(playerIds);

  const scorerLines: string[] = [];
  for (const g of match.home_goals ?? []) {
    scorerLines.push(
      formatScorerLine(
        g,
        match.home_name,
        match.round_id,
        fifaProfiles,
        dbPlayers,
        locale,
      ),
    );
  }
  for (const g of match.away_goals ?? []) {
    scorerLines.push(
      formatScorerLine(
        g,
        match.away_name,
        match.round_id,
        fifaProfiles,
        dbPlayers,
        locale,
      ),
    );
  }

  let groupTable: string | null = null;
  let homeStandingLine: string | null = null;
  let awayStandingLine: string | null = null;
  let standingsSnapshot = "";

  const isGroupStage =
    (match.round_stage ?? "").toUpperCase() === "GROUP" || match.round_id <= 3;

  if (isGroupStage && groupLetter) {
    const standings = computeGroupStandings(
      groupLetter,
      match.round_id,
      squadGroups,
      allMatches,
    );
    if (standings.length) {
      standingsSnapshot = standings
        .map((r) => `${r.code}:${r.pts}:${r.gd}`)
        .join(",");
      const roundLabel = roundLabelForLocale(match, locale);
      groupTable =
        locale === "zh"
          ? `${roundLabel} 后 ${groupLetter} 组积分榜：${standings.map((r) => formatStandingRow(r, locale)).join("；")}`
          : `Group ${groupLetter} after ${roundLabel}: ${standings.map((r) => formatStandingRow(r, locale)).join("; ")}`;
      homeStandingLine = (() => {
        const row = standings.find((r) => r.code === match.home_code);
        return row ? formatStandingRow(row, locale) : null;
      })();
      awayStandingLine = (() => {
        const row = standings.find((r) => r.code === match.away_code);
        return row ? formatStandingRow(row, locale) : null;
      })();
    }
  }

  const homeElim = squads.find((s) => s.id === match.home_squad_id)?.isEliminated;
  const awayElim = squads.find((s) => s.id === match.away_squad_id)?.isEliminated;

  const fingerprintExtra = [
    groupLetter ?? "",
    standingsSnapshot,
    collectGoalPlayerIds(match).join("|"),
    String(homeElim),
    String(awayElim),
  ].join(":");

  return {
    version: MATCH_ENRICHMENT_VERSION,
    stageLabel: stageDisplay(match.round_stage, match.round_id, locale),
    groupLetter,
    matchDetail: formatMatchDetail(match, locale),
    homeForm: teamResultsBefore(match.home_code, match, allMatches, locale),
    awayForm: teamResultsBefore(match.away_code, match, allMatches, locale),
    groupTable,
    homeStandingLine,
    awayStandingLine,
    scorerLines,
    fingerprintExtra,
  };
}

export function formatMatchTimeline(
  match: WcMatchRow,
  locale: SummaryLocale = "en",
): string | null {
  type Row = { sort: number; line: string };
  const rows: Row[] = [];

  const fmtMin = (minute: string | null) => {
    if (!minute) return "";
    return minute.includes("'") ? minute : `${minute}'`;
  };

  for (const g of match.home_goals ?? []) {
    const min = fmtMin(g.minute);
    const assist =
      g.assist_display
        ? locale === "zh"
          ? `，助攻 ${g.assist_display}`
          : `, assist ${g.assist_display}`
        : "";
    rows.push({
      sort: g.sort_key,
      line:
        locale === "zh"
          ? `${min ? `${min} ` : ""}进球 ${g.scorer_display}${assist}（${match.home_name}）`
          : `${min ? `${min} ` : ""}GOAL ${g.scorer_display}${assist} (${match.home_name})`,
    });
  }
  for (const g of match.away_goals ?? []) {
    const min = fmtMin(g.minute);
    const assist =
      g.assist_display
        ? locale === "zh"
          ? `，助攻 ${g.assist_display}`
          : `, assist ${g.assist_display}`
        : "";
    rows.push({
      sort: g.sort_key,
      line:
        locale === "zh"
          ? `${min ? `${min} ` : ""}进球 ${g.scorer_display}${assist}（${match.away_name}）`
          : `${min ? `${min} ` : ""}GOAL ${g.scorer_display}${assist} (${match.away_name})`,
    });
  }
  for (const c of match.home_cards ?? []) {
    const min = fmtMin(c.minute);
    const cardLabel = c.card === "red" ? "红牌" : "黄牌";
    rows.push({
      sort: c.sort_key,
      line:
        locale === "zh"
          ? `${min ? `${min} ` : ""}${cardLabel} ${c.player_display}（${match.home_name}）`
          : `${min ? `${min} ` : ""}${c.card.toUpperCase()} CARD ${c.player_display} (${match.home_name})`,
    });
  }
  for (const c of match.away_cards ?? []) {
    const min = fmtMin(c.minute);
    const cardLabel = c.card === "red" ? "红牌" : "黄牌";
    rows.push({
      sort: c.sort_key,
      line:
        locale === "zh"
          ? `${min ? `${min} ` : ""}${cardLabel} ${c.player_display}（${match.away_name}）`
          : `${min ? `${min} ` : ""}${c.card.toUpperCase()} CARD ${c.player_display} (${match.away_name})`,
    });
  }

  if (!rows.length) return null;
  rows.sort((a, b) => b.sort - a.sort);
  return rows.map((r) => `- ${r.line}`).join("\n");
}

export function formatEnrichmentFacts(
  match: WcMatchRow,
  enrichment: MatchEnrichment,
  locale: SummaryLocale = "en",
): string {
  if (locale === "zh") {
    const lines = [
      `阶段：${enrichment.stageLabel}`,
      enrichment.groupLetter ? `小组：${enrichment.groupLetter} 组` : null,
      `比赛详情：${enrichment.matchDetail}`,
      `${match.home_name} 赛前走势：${enrichment.homeForm}`,
      `${match.away_name} 赛前走势：${enrichment.awayForm}`,
      enrichment.groupTable,
      enrichment.homeStandingLine
        ? `${match.home_name} 小组排名：${enrichment.homeStandingLine}`
        : null,
      enrichment.awayStandingLine
        ? `${match.away_name} 小组排名：${enrichment.awayStandingLine}`
        : null,
      enrichment.scorerLines.length
        ? `进球球员详情：\n${enrichment.scorerLines.map((l) => `- ${l}`).join("\n")}`
        : null,
    ].filter(Boolean) as string[];
    return lines.join("\n");
  }

  const lines = [
    `Stage: ${enrichment.stageLabel}`,
    enrichment.groupLetter ? `Group: ${enrichment.groupLetter}` : null,
    `Match detail: ${enrichment.matchDetail}`,
    `${match.home_name} before kickoff: ${enrichment.homeForm}`,
    `${match.away_name} before kickoff: ${enrichment.awayForm}`,
    enrichment.groupTable,
    enrichment.homeStandingLine
      ? `${match.home_name} group position: ${enrichment.homeStandingLine}`
      : null,
    enrichment.awayStandingLine
      ? `${match.away_name} group position: ${enrichment.awayStandingLine}`
      : null,
    enrichment.scorerLines.length
      ? `Goal scorers detail:\n${enrichment.scorerLines.map((l) => `- ${l}`).join("\n")}`
      : null,
  ].filter(Boolean) as string[];

  return lines.join("\n");
}
