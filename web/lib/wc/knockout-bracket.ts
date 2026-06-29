import type { FifaRoundRow, FifaTournamentRow, WcMatchRow } from "@/lib/wc/fifa-rounds";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";

export type BracketTeam = { code: string; name: string };

export type BracketMatch = {
  id: number | null;
  roundId: number;
  stage: string;
  home: BracketTeam | null;
  away: BracketTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalty: number | null;
  awayPenalty: number | null;
  status: string;
  kickoff: string | null;
  winner: BracketTeam | null;
};

export type BracketRound = {
  roundId: number;
  stage: string;
  label: string;
  matches: BracketMatch[];
};

export type KnockoutBracket = {
  rounds: BracketRound[];
  highlightStage: string;
};

const KNOCKOUT_ROUND_IDS = [4, 5, 6, 7, 8] as const;

const ROUND_LABELS: Record<
  number,
  { stage: string; en: string; zh: string; slots: number }
> = {
  4: { stage: "R32", en: "Round of 32", zh: "32强", slots: 16 },
  5: { stage: "R16", en: "Round of 16", zh: "16强", slots: 8 },
  6: { stage: "QF", en: "Quarter-finals", zh: "四分之一决赛", slots: 4 },
  7: { stage: "SF", en: "Semi-finals", zh: "半决赛", slots: 2 },
  8: { stage: "F", en: "Final", zh: "决赛", slots: 1 },
};

function squadAbbrToCodeLocal(abbr: string, name: string): string {
  const fromAbbr = fifaTeamToWcCode({ short_name: abbr, name: abbr });
  if (fromAbbr) return fromAbbr;
  const fromName = fifaTeamToWcCode({ name, short_name: abbr });
  return fromName ?? abbr.toUpperCase();
}

function team(code: string, name: string): BracketTeam {
  return { code, name };
}

function winnerFromScores(
  home: BracketTeam,
  away: BracketTeam,
  homeScore: number,
  awayScore: number,
  homePenalty: number | null,
  awayPenalty: number | null,
): BracketTeam | null {
  if (homePenalty != null && awayPenalty != null && homePenalty !== awayPenalty) {
    return homePenalty > awayPenalty ? home : away;
  }
  if (homeScore > awayScore) return home;
  if (awayScore > homeScore) return away;
  return null;
}

function fromWcMatchRow(m: WcMatchRow): BracketMatch {
  const home = team(m.home_code, m.home_name);
  const away = team(m.away_code, m.away_name);
  const hs = m.home_score;
  const as = m.away_score;
  const finished = isWcMatchFinished(m);
  const winner =
    finished && hs != null && as != null
      ? winnerFromScores(
          home,
          away,
          hs,
          as,
          m.home_penalty_score,
          m.away_penalty_score,
        )
      : null;

  return {
    id: m.id,
    roundId: m.round_id,
    stage: m.round_stage ?? ROUND_LABELS[m.round_id]?.stage ?? "",
    home,
    away,
    homeScore: hs,
    awayScore: as,
    homePenalty: m.home_penalty_score,
    awayPenalty: m.away_penalty_score,
    status: m.status,
    kickoff: m.kickoff,
    winner,
  };
}

function fromFifaTournament(t: FifaTournamentRow, roundId: number): BracketMatch {
  const home = team(
    squadAbbrToCodeLocal(t.homeSquadAbbr, t.homeSquadName),
    t.homeSquadName,
  );
  const away = team(
    squadAbbrToCodeLocal(t.awaySquadAbbr, t.awaySquadName),
    t.awaySquadName,
  );
  const hs = t.homeScore;
  const as = t.awayScore;
  const finished =
    t.status.toLowerCase() === "complete" ||
    t.status.toLowerCase() === "finished" ||
    hs != null;
  const winner =
    finished && hs != null && as != null
      ? winnerFromScores(
          home,
          away,
          hs,
          as,
          t.homePenaltyScore ?? null,
          t.awayPenaltyScore ?? null,
        )
      : null;

  return {
    id: t.id,
    roundId,
    stage: ROUND_LABELS[roundId]?.stage ?? "",
    home,
    away,
    homeScore: hs,
    awayScore: as,
    homePenalty: t.homePenaltyScore ?? null,
    awayPenalty: t.awayPenaltyScore ?? null,
    status: t.status,
    kickoff: t.date,
    winner,
  };
}

function mergeBracketMatch(
  fifa: BracketMatch,
  enriched: WcMatchRow | undefined,
): BracketMatch {
  if (!enriched) return fifa;
  return fromWcMatchRow(enriched);
}

function advancePair(a: BracketMatch, b: BracketMatch, roundId: number): BracketMatch {
  const meta = ROUND_LABELS[roundId];
  return {
    id: null,
    roundId,
    stage: meta?.stage ?? "",
    home: a.winner,
    away: b.winner,
    homeScore: null,
    awayScore: null,
    homePenalty: null,
    awayPenalty: null,
    status: "scheduled",
    kickoff: null,
    winner: null,
  };
}

export function buildKnockoutBracket(
  fifaRounds: FifaRoundRow[],
  matchesById: Map<number, WcMatchRow>,
  locale: string,
): KnockoutBracket | null {
  const r32 = fifaRounds.find((r) => r.id === 4);
  if (!r32?.tournaments?.length) return null;

  const isZh = locale.toLowerCase().startsWith("zh");
  const built: BracketRound[] = [];
  let prevMatches: BracketMatch[] = [];

  for (const roundId of KNOCKOUT_ROUND_IDS) {
    const meta = ROUND_LABELS[roundId];
    const fifaRound = fifaRounds.find((r) => r.id === roundId);
    let matches: BracketMatch[];

    if (fifaRound?.tournaments?.length) {
      matches = fifaRound.tournaments.map((t) =>
        mergeBracketMatch(
          fromFifaTournament(t, roundId),
          matchesById.get(t.id),
        ),
      );
    } else if (prevMatches.length >= 2) {
      matches = [];
      for (let i = 0; i < prevMatches.length; i += 2) {
        matches.push(advancePair(prevMatches[i]!, prevMatches[i + 1]!, roundId));
      }
    } else {
      break;
    }

    built.push({
      roundId,
      stage: meta.stage,
      label: isZh ? meta.zh : meta.en,
      matches,
    });
    prevMatches = matches;
  }

  if (built.length === 0) return null;

  const highlightStage =
    built.find((r) =>
      r.matches.some(
        (m) =>
          m.status.toLowerCase() !== "complete" &&
          m.status.toLowerCase() !== "finished" &&
          m.status.toLowerCase() !== "scheduled",
      ),
    )?.stage ??
    built.find((r) => r.matches.some((m) => m.status.toLowerCase() === "scheduled"))
      ?.stage ??
    built[0]!.stage;

  return { rounds: built, highlightStage };
}
