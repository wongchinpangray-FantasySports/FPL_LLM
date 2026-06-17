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

export const MATCH_ENRICHMENT_VERSION = "v3";

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

function stageDisplay(stage: string | null, roundId: number): string {
  const s = (stage ?? "").toUpperCase();
  if (s === "GROUP") return `Group stage (${roundId <= 3 ? `MD${roundId}` : "MD" + roundId})`;
  if (s === "R32") return "Round of 32";
  if (s === "R16") return "Round of 16";
  if (s === "QF") return "Quarter-final";
  if (s === "SF") return "Semi-final";
  if (s === "F") return "Final";
  return s || `Round ${roundId}`;
}

function formatMatchDetail(match: WcMatchRow): string {
  const parts: string[] = [];
  if (match.period) {
    parts.push(`Period: ${match.period.replace(/_/g, " ")}`);
  }
  if (match.minutes > 0) {
    const clock =
      match.extra_minutes > 0
        ? `${match.minutes} min (+${match.extra_minutes} added time)`
        : `${match.minutes} min`;
    parts.push(`Played ${clock}`);
  }
  const hp = match.home_penalty_score;
  const ap = match.away_penalty_score;
  if (
    (hp != null && hp > 0) ||
    (ap != null && ap > 0) ||
    match.period?.includes("penalt")
  ) {
    parts.push(
      `Penalties: ${match.home_name} ${hp ?? 0} - ${ap ?? 0} ${match.away_name}`,
    );
  }
  return parts.join("; ") || "Full time";
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
    return "Opening match of the tournament";
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
      tokens.push(`W ${gf}-${ga} vs ${opp}`);
      w++;
    } else if (gf < ga) {
      tokens.push(`L ${gf}-${ga} vs ${opp}`);
      l++;
    } else {
      tokens.push(`D ${gf}-${ga} vs ${opp}`);
      d++;
    }
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

function formatStandingRow(row: TeamStanding): string {
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
): string {
  const parts: string[] = [`${g.scorer_display} (${teamName})`];
  const scorerId = g.fifa_player_id;
  const assistId = g.fifa_assist_id;

  const fifa = scorerId ? fifaProfiles.get(scorerId) : undefined;
  const db = scorerId ? dbPlayers.get(scorerId) : undefined;

  const meta: string[] = [];
  if (fifa?.position) meta.push(fifa.position);
  if (db?.season_club) meta.push(`club: ${db.season_club}`);
  if (db && (db.goals > 0 || db.assists > 0)) {
    meta.push(`season ${db.goals}G ${db.assists}A`);
  }
  if (fifa?.roundPoints[String(roundId)] != null) {
    meta.push(`${fifa.roundPoints[String(roundId)]} FPL pts this MD`);
  }
  if (meta.length) parts.push(`[${meta.join(", ")}]`);

  if (g.assist_display) {
    const assistMeta: string[] = [];
    const af = assistId ? fifaProfiles.get(assistId) : undefined;
    const adb = assistId ? dbPlayers.get(assistId) : undefined;
    if (af?.position) assistMeta.push(af.position);
    if (adb?.season_club) assistMeta.push(`club: ${adb.season_club}`);
    if (af?.roundPoints[String(roundId)] != null) {
      assistMeta.push(`${af.roundPoints[String(roundId)]} FPL pts this MD`);
    }
    parts.push(
      assistMeta.length
        ? `assist ${g.assist_display} [${assistMeta.join(", ")}]`
        : `assist ${g.assist_display}`,
    );
  }

  return parts.join(", ");
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
      ),
    );
  }

  let groupTable: string | null = null;
  let homeStandingLine: string | null = null;
  let awayStandingLine: string | null = null;

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
      groupTable = `Group ${groupLetter} after ${match.round_label}: ${standings.map(formatStandingRow).join("; ")}`;
      homeStandingLine = (() => {
        const row = standings.find((r) => r.code === match.home_code);
        return row ? formatStandingRow(row) : null;
      })();
      awayStandingLine = (() => {
        const row = standings.find((r) => r.code === match.away_code);
        return row ? formatStandingRow(row) : null;
      })();
    }
  }

  const homeElim = squads.find((s) => s.id === match.home_squad_id)?.isEliminated;
  const awayElim = squads.find((s) => s.id === match.away_squad_id)?.isEliminated;

  const fingerprintExtra = [
    groupTable ?? "",
    scorerLines.join("|"),
    String(homeElim),
    String(awayElim),
  ].join(":");

  return {
    version: MATCH_ENRICHMENT_VERSION,
    stageLabel: stageDisplay(match.round_stage, match.round_id),
    groupLetter,
    matchDetail: formatMatchDetail(match),
    homeForm: teamResultsBefore(match.home_code, match, allMatches),
    awayForm: teamResultsBefore(match.away_code, match, allMatches),
    groupTable,
    homeStandingLine,
    awayStandingLine,
    scorerLines,
    fingerprintExtra,
  };
}

export function formatMatchTimeline(match: WcMatchRow): string | null {
  type Row = { sort: number; line: string };
  const rows: Row[] = [];

  const fmtMin = (minute: string | null) => {
    if (!minute) return "";
    return minute.includes("'") ? minute : `${minute}'`;
  };

  for (const g of match.home_goals ?? []) {
    const min = fmtMin(g.minute);
    const assist = g.assist_display ? `, assist ${g.assist_display}` : "";
    rows.push({
      sort: g.sort_key,
      line: `${min ? `${min} ` : ""}GOAL ${g.scorer_display}${assist} (${match.home_name})`,
    });
  }
  for (const g of match.away_goals ?? []) {
    const min = fmtMin(g.minute);
    const assist = g.assist_display ? `, assist ${g.assist_display}` : "";
    rows.push({
      sort: g.sort_key,
      line: `${min ? `${min} ` : ""}GOAL ${g.scorer_display}${assist} (${match.away_name})`,
    });
  }
  for (const c of match.home_cards ?? []) {
    const min = fmtMin(c.minute);
    rows.push({
      sort: c.sort_key,
      line: `${min ? `${min} ` : ""}${c.card.toUpperCase()} CARD ${c.player_display} (${match.home_name})`,
    });
  }
  for (const c of match.away_cards ?? []) {
    const min = fmtMin(c.minute);
    rows.push({
      sort: c.sort_key,
      line: `${min ? `${min} ` : ""}${c.card.toUpperCase()} CARD ${c.player_display} (${match.away_name})`,
    });
  }

  if (!rows.length) return null;
  rows.sort((a, b) => b.sort - a.sort);
  return rows.map((r) => `- ${r.line}`).join("\n");
}

export function formatEnrichmentFacts(
  match: WcMatchRow,
  enrichment: MatchEnrichment,
): string {
  const lines = [
    `Stage: ${enrichment.stageLabel}`,
    enrichment.groupLetter
      ? `Group: ${enrichment.groupLetter}`
      : null,
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
