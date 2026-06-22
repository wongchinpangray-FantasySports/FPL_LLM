import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

const FIFA_JSON_BASE = "https://play.fifa.com/json/fantasy";

const FIFA_HEADERS = {
  Accept: "application/json",
  Origin: "https://fantasy.fifa.com",
  Referer: "https://fantasy.fifa.com/",
};

type GoalScorerEntry = {
  playerId?: number;
  assistId?: number | null;
};

export type FifaTournamentRow = {
  id: number;
  period: string | null;
  minutes: number;
  extraMinutes: number;
  venueName: string | null;
  venueCity: string | null;
  date: string | null;
  status: string;
  homeSquadId: number;
  awaySquadId: number;
  homeSquadName: string;
  awaySquadName: string;
  homeSquadAbbr: string;
  awaySquadAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  homeGoalScorersAssists: unknown;
  awayGoalScorersAssists: unknown;
};

export type FifaRoundRow = {
  id: number;
  status: string;
  stage?: string | null;
  startDate: string | null;
  endDate: string | null;
  tournaments: FifaTournamentRow[];
};

export type WcTeamMatchStats = {
  xg: number | null;
  shots: number | null;
  shots_on_target: number | null;
  possession: number | null;
  corners: number | null;
  fouls: number | null;
};

export type WcMatchGoal = {
  minute: string | null;
  sort_key: number;
  scorer: string;
  scorer_display: string;
  assist: string | null;
  assist_display: string | null;
  fifa_player_id?: number;
  fifa_assist_id?: number | null;
};

export type WcMatchCardEvent = {
  minute: string | null;
  sort_key: number;
  player: string;
  player_display: string;
  card: "yellow" | "red";
};

export type WcMatchRow = {
  id: number;
  round_id: number;
  round_label: string;
  round_stage: string | null;
  kickoff: string | null;
  venue: string | null;
  venue_city: string | null;
  status: string;
  period: string | null;
  minutes: number;
  extra_minutes: number;
  home_squad_id: number;
  away_squad_id: number;
  home_code: string;
  away_code: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_penalty_score: number | null;
  away_penalty_score: number | null;
  /** @deprecated plain-text fallback */
  home_scorers: string | null;
  away_scorers: string | null;
  home_goals: WcMatchGoal[];
  away_goals: WcMatchGoal[];
  home_cards: WcMatchCardEvent[];
  away_cards: WcMatchCardEvent[];
  stats_available: boolean;
  home_stats: WcTeamMatchStats | null;
  away_stats: WcTeamMatchStats | null;
};

let playerNameCache: Map<number, string> | null = null;
let playerNameCacheAt = 0;
const PLAYER_CACHE_MS = 15 * 60 * 1000;

function squadAbbrToCode(abbr: string, name: string): string {
  const fromAbbr = fifaTeamToWcCode({ short_name: abbr, name: abbr });
  if (fromAbbr) return fromAbbr;
  const fromName = fifaTeamToWcCode({ name, short_name: abbr });
  return fromName ?? abbr.toUpperCase();
}

function roundLabel(id: number): string {
  if (id <= 3) return `MD${id}`;
  if (id === 8) return "Final";
  return `R${id}`;
}

export function wcRoundLabel(id: number): string {
  return roundLabel(id);
}

function playerLabel(id: number, names: Map<number, string>): string {
  return names.get(id) ?? `Player ${id}`;
}

/** FIFA-style display: last name in uppercase (e.g. Raul JIMENEZ). */
export function formatFifaPlayerDisplay(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name;
  if (parts.length === 1) return parts[0]!.toUpperCase();
  const last = parts.pop()!.toUpperCase();
  return [...parts, last].join(" ");
}

export function minuteToSortKey(minute: string | null, fallback: number): number {
  if (!minute) return fallback;
  const m = minute.match(/^(\d+)(?:\+(\d+))?/);
  if (!m) return fallback;
  const base = Number(m[1]) * 100;
  const extra = m[2] ? Number(m[2]) : 0;
  return base + extra;
}

export function parseFifaGoals(
  raw: unknown,
  names: Map<number, string>,
): WcMatchGoal[] {
  if (raw == null || !Array.isArray(raw)) return [];
  const goals: WcMatchGoal[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const entry = item as GoalScorerEntry;
    if (entry.playerId == null) return;
    const scorer = playerLabel(entry.playerId, names);
    const assist =
      entry.assistId != null ? playerLabel(entry.assistId, names) : null;
    goals.push({
      minute: null,
      sort_key: idx,
      scorer,
      scorer_display: formatFifaPlayerDisplay(scorer),
      assist,
      assist_display: assist ? formatFifaPlayerDisplay(assist) : null,
      fifa_player_id: entry.playerId,
      fifa_assist_id: entry.assistId ?? null,
    });
  });
  return goals.reverse();
}

/** FIFA returns goal scorers as string, array of {playerId, assistId}, or null. */
export function formatGoalScorersAssists(
  raw: unknown,
  names: Map<number, string>,
): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    return s || null;
  }
  if (!Array.isArray(raw)) return null;

  const parts: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as GoalScorerEntry;
    if (entry.playerId == null) continue;
    const scorer = playerLabel(entry.playerId, names);
    if (entry.assistId != null) {
      parts.push(`${scorer} (${playerLabel(entry.assistId, names)})`);
    } else {
      parts.push(scorer);
    }
  }
  return parts.length > 0 ? parts.join(", ") : null;
}

export function isWcMatchFinished(m: Pick<WcMatchRow, "status" | "home_score">): boolean {
  const s = m.status.toLowerCase();
  return s === "finished" || s === "complete" || m.home_score != null;
}

export async function loadFifaPlayerNames(): Promise<Map<number, string>> {
  if (playerNameCache && Date.now() - playerNameCacheAt < PLAYER_CACHE_MS) {
    return playerNameCache;
  }
  const res = await fetch(`${FIFA_JSON_BASE}/players.json`, {
    headers: FIFA_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return playerNameCache ?? new Map();

  const raw = await res.json();
  const list = Array.isArray(raw)
    ? raw
    : ((raw as { players?: unknown[] }).players ?? []);

  const map = new Map<number, string>();
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const row = p as {
      id?: number;
      firstName?: string;
      lastName?: string;
      knownName?: string | null;
    };
    if (row.id == null) continue;
    const name =
      row.knownName?.trim() ||
      `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
    if (name) map.set(row.id, name);
  }

  playerNameCache = map;
  playerNameCacheAt = Date.now();
  return map;
}

export async function fetchFifaRounds(): Promise<FifaRoundRow[]> {
  const res = await fetch(`${FIFA_JSON_BASE}/rounds.json`, {
    headers: FIFA_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FIFA rounds.json HTTP ${res.status}`);
  const data = (await res.json()) as FifaRoundRow[];
  return Array.isArray(data) ? data : [];
}

export function parseFifaRoundsToMatches(
  rounds: FifaRoundRow[],
  playerNames: Map<number, string>,
): WcMatchRow[] {
  const rows: WcMatchRow[] = [];
  for (const round of rounds) {
    for (const m of round.tournaments ?? []) {
      rows.push({
        id: m.id,
        round_id: round.id,
        round_label: roundLabel(round.id),
        round_stage: round.stage ?? null,
        kickoff: m.date,
        venue: m.venueName,
        venue_city: m.venueCity,
        status: m.status,
        period: m.period,
        minutes: m.minutes ?? 0,
        extra_minutes: m.extraMinutes ?? 0,
        home_squad_id: m.homeSquadId,
        away_squad_id: m.awaySquadId,
        home_code: squadAbbrToCode(m.homeSquadAbbr, m.homeSquadName),
        away_code: squadAbbrToCode(m.awaySquadAbbr, m.awaySquadName),
        home_name: m.homeSquadName,
        away_name: m.awaySquadName,
        home_score: m.homeScore,
        away_score: m.awayScore,
        home_penalty_score: m.homePenaltyScore ?? null,
        away_penalty_score: m.awayPenaltyScore ?? null,
        home_scorers: formatGoalScorersAssists(
          m.homeGoalScorersAssists,
          playerNames,
        ),
        away_scorers: formatGoalScorersAssists(
          m.awayGoalScorersAssists,
          playerNames,
        ),
        home_goals: parseFifaGoals(m.homeGoalScorersAssists, playerNames),
        away_goals: parseFifaGoals(m.awayGoalScorersAssists, playerNames),
        home_cards: [],
        away_cards: [],
        stats_available: false,
        home_stats: null,
        away_stats: null,
      });
    }
  }
  return rows.sort((a, b) => {
    const ta = a.kickoff ? Date.parse(a.kickoff) : 0;
    const tb = b.kickoff ? Date.parse(b.kickoff) : 0;
    return ta - tb || a.id - b.id;
  });
}

export async function buildWcMatchSchedule(): Promise<{
  rounds: number[];
  matches: WcMatchRow[];
}> {
  const [rounds, playerNames] = await Promise.all([
    fetchFifaRounds(),
    loadFifaPlayerNames(),
  ]);
  const matches = parseFifaRoundsToMatches(rounds, playerNames);
  const roundIds = [...new Set(matches.map((m) => m.round_id))].sort(
    (a, b) => a - b,
  );
  return { rounds: roundIds, matches };
}

/** Coerce JSONB / API stats to numbers for safe UI rendering. */
export function normalizeTeamMatchStats(
  raw: unknown,
): WcTeamMatchStats | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    xg: num(o.xg),
    shots: num(o.shots),
    shots_on_target: num(o.shots_on_target),
    possession: num(o.possession),
    corners: num(o.corners),
    fouls: num(o.fouls),
  };
}

export function normalizeMatchGoals(raw: unknown): WcMatchGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const g = item as Record<string, unknown>;
      const scorer = String(g.scorer ?? "");
      if (!scorer) return null;
      const assist = g.assist != null ? String(g.assist) : null;
      const minute = g.minute != null ? String(g.minute) : null;
      return {
        minute,
        sort_key: Number(g.sort_key ?? minuteToSortKey(minute, idx)),
        scorer,
        scorer_display: String(g.scorer_display ?? formatFifaPlayerDisplay(scorer)),
        assist,
        assist_display: assist
          ? String(g.assist_display ?? formatFifaPlayerDisplay(assist))
          : null,
      } satisfies WcMatchGoal;
    })
    .filter(Boolean) as WcMatchGoal[];
}

export function normalizeMatchCards(raw: unknown): WcMatchCardEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, idx) => {
      if (!item || typeof item !== "object") return null;
      const c = item as Record<string, unknown>;
      const player = String(c.player ?? "");
      if (!player) return null;
      const card = c.card === "yellow" ? "yellow" : "red";
      const minute = c.minute != null ? String(c.minute) : null;
      return {
        minute,
        sort_key: Number(c.sort_key ?? minuteToSortKey(minute, idx)),
        player,
        player_display: String(
          c.player_display ?? formatFifaPlayerDisplay(player),
        ),
        card,
      } satisfies WcMatchCardEvent;
    })
    .filter(Boolean) as WcMatchCardEvent[];
}
