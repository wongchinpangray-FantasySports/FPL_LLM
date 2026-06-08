import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

const FIFA_JSON_BASE = "https://play.fifa.com/json/fantasy";

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
  homeGoalScorersAssists: string | null;
  awayGoalScorersAssists: string | null;
};

export type FifaRoundRow = {
  id: number;
  status: string;
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

export type WcMatchRow = {
  id: number;
  round_id: number;
  round_label: string;
  kickoff: string | null;
  venue: string | null;
  venue_city: string | null;
  status: string;
  period: string | null;
  minutes: number;
  extra_minutes: number;
  home_code: string;
  away_code: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_scorers: string | null;
  away_scorers: string | null;
  stats_available: boolean;
  home_stats: WcTeamMatchStats | null;
  away_stats: WcTeamMatchStats | null;
};

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

export async function fetchFifaRounds(): Promise<FifaRoundRow[]> {
  const res = await fetch(`${FIFA_JSON_BASE}/rounds.json`, {
    headers: {
      Accept: "application/json",
      Origin: "https://fantasy.fifa.com",
      Referer: "https://fantasy.fifa.com/",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FIFA rounds.json HTTP ${res.status}`);
  const data = (await res.json()) as FifaRoundRow[];
  return Array.isArray(data) ? data : [];
}

export function parseFifaRoundsToMatches(rounds: FifaRoundRow[]): WcMatchRow[] {
  const rows: WcMatchRow[] = [];
  for (const round of rounds) {
    for (const m of round.tournaments ?? []) {
      rows.push({
        id: m.id,
        round_id: round.id,
        round_label: roundLabel(round.id),
        kickoff: m.date,
        venue: m.venueName,
        venue_city: m.venueCity,
        status: m.status,
        period: m.period,
        minutes: m.minutes ?? 0,
        extra_minutes: m.extraMinutes ?? 0,
        home_code: squadAbbrToCode(m.homeSquadAbbr, m.homeSquadName),
        away_code: squadAbbrToCode(m.awaySquadAbbr, m.awaySquadName),
        home_name: m.homeSquadName,
        away_name: m.awaySquadName,
        home_score: m.homeScore,
        away_score: m.awayScore,
        home_scorers: m.homeGoalScorersAssists,
        away_scorers: m.awayGoalScorersAssists,
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
  const rounds = await fetchFifaRounds();
  const matches = parseFifaRoundsToMatches(rounds);
  const roundIds = [...new Set(matches.map((m) => m.round_id))].sort(
    (a, b) => a - b,
  );
  return { rounds: roundIds, matches };
}
