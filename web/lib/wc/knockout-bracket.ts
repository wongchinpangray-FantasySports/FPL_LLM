import type { FifaRoundRow, FifaTournamentRow, WcMatchRow } from "@/lib/wc/fifa-rounds";
import { fifaTeamToWcCode } from "@/lib/wc/fifa-teams";
import {
  WC2026_BRONZE,
  WC2026_FINAL,
  WC2026_LEFT_QF,
  WC2026_LEFT_R16,
  WC2026_LEFT_R32_PAIRS,
  WC2026_LEFT_SF,
  WC2026_RIGHT_QF,
  WC2026_RIGHT_R16,
  WC2026_RIGHT_R32_PAIRS,
  WC2026_RIGHT_SF,
  WC2026_FEEDERS,
  WC2026_ROUND_ORDER,
} from "@/lib/wc/knockout-bracket-topology";

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

export type BracketSideTree = {
  r32: BracketMatch[];
  r16: BracketMatch[];
  qf: BracketMatch[];
  sf: BracketMatch | null;
};

export type SplitKnockoutBracket = {
  left: BracketSideTree;
  right: BracketSideTree;
  bronze: BracketMatch | null;
  final: BracketMatch | null;
};

export function splitKnockoutBracket(
  bracket: KnockoutBracket,
): SplitKnockoutBracket {
  const byId = new Map<number, BracketMatch>();
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      if (match.id != null) byId.set(match.id, match);
    }
  }

  const pick = (id: number): BracketMatch =>
    byId.get(id) ?? placeholderMatch(id, roundIdForMatch(id));

  return {
    left: {
      r32: WC2026_LEFT_R32_PAIRS.flat().map((id) => pick(id)),
      r16: WC2026_LEFT_R16.map((id) => pick(id)),
      qf: WC2026_LEFT_QF.map((id) => pick(id)),
      sf: pick(WC2026_LEFT_SF),
    },
    right: {
      r32: WC2026_RIGHT_R32_PAIRS.flat().map((id) => pick(id)),
      r16: WC2026_RIGHT_R16.map((id) => pick(id)),
      qf: WC2026_RIGHT_QF.map((id) => pick(id)),
      sf: pick(WC2026_RIGHT_SF),
    },
    final: pick(WC2026_FINAL),
    bronze: pick(WC2026_BRONZE),
  };
}

const KNOCKOUT_ROUND_IDS = [4, 5, 6, 7, 8] as const;

const ROUND_LABELS: Record<
  number,
  { stage: string; en: string; zh: string; slots: number }
> = {
  4: { stage: "R32", en: "Round of 32", zh: "1/16决赛", slots: 16 },
  5: { stage: "R16", en: "Round of 16", zh: "1/8决赛", slots: 8 },
  6: { stage: "QF", en: "Quarter-finals", zh: "1/4决赛", slots: 4 },
  7: { stage: "SF", en: "Semi-finals", zh: "半决赛", slots: 2 },
  8: { stage: "F", en: "Final", zh: "决赛", slots: 1 },
};

function roundIdForMatch(matchId: number): number {
  if (matchId >= 104) return 8;
  if (matchId === 103) return 8;
  if (matchId >= 101) return 7;
  if (matchId >= 97) return 6;
  if (matchId >= 89) return 5;
  return 4;
}

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

function isKnockoutComplete(status: string): boolean {
  const s = status.toLowerCase();
  return s === "complete" || s === "finished";
}

function fromWcMatchRow(m: WcMatchRow): BracketMatch {
  const home = team(m.home_code, m.home_name);
  const away = team(m.away_code, m.away_name);
  const hs = m.home_score;
  const as = m.away_score;
  const finished = isKnockoutComplete(m.status);
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
  const finished = isKnockoutComplete(t.status);
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

  const cache = fromWcMatchRow(enriched);
  const fifaFinished = isKnockoutComplete(fifa.status);
  const cacheFinished = isKnockoutComplete(cache.status);

  // Prefer live FIFA scores/penalties/winner for knockout results.
  if (fifaFinished && fifa.homeScore != null && fifa.awayScore != null) {
    return {
      ...cache,
      home: fifa.home,
      away: fifa.away,
      homeScore: fifa.homeScore,
      awayScore: fifa.awayScore,
      homePenalty: fifa.homePenalty ?? cache.homePenalty,
      awayPenalty: fifa.awayPenalty ?? cache.awayPenalty,
      status: fifa.status,
      winner: fifa.winner ?? cache.winner,
      kickoff: cache.kickoff ?? fifa.kickoff,
    };
  }

  if (
    cacheFinished &&
    cache.homeScore != null &&
    cache.awayScore != null &&
    cache.homePenalty == null &&
    fifa.homePenalty != null
  ) {
    return {
      ...cache,
      homePenalty: fifa.homePenalty,
      awayPenalty: fifa.awayPenalty,
      winner: fifa.winner ?? cache.winner,
    };
  }

  return cache;
}

function placeholderMatch(id: number, roundId: number): BracketMatch {
  return {
    id,
    roundId,
    stage: ROUND_LABELS[roundId]?.stage ?? "",
    home: null,
    away: null,
    homeScore: null,
    awayScore: null,
    homePenalty: null,
    awayPenalty: null,
    status: "scheduled",
    kickoff: null,
    winner: null,
  };
}

function teamsMatch(
  m: BracketMatch,
  home: BracketTeam,
  away: BracketTeam,
): boolean {
  if (!m.home || !m.away) return false;
  return (
    (m.home.code === home.code && m.away.code === away.code) ||
    (m.home.code === away.code && m.away.code === home.code)
  );
}

function resolveSlotMatch(
  slotId: number,
  roundId: number,
  resolved: Map<number, BracketMatch>,
  pool: BracketMatch[],
): BracketMatch {
  // Third-place play-off — use FIFA fixture when published (not winner feeders).
  if (slotId === WC2026_BRONZE) {
    const direct = pool.find((m) => m.id === slotId);
    if (direct?.home && direct?.away) return { ...direct, id: slotId };
    return placeholderMatch(slotId, roundId);
  }

  const feeders = WC2026_FEEDERS[slotId];

  // Round of 32 — fixed fixtures from FIFA.
  if (!feeders) {
    const direct = resolved.get(slotId) ?? pool.find((m) => m.id === slotId);
    if (direct) return { ...direct, id: slotId };
    return placeholderMatch(slotId, roundId);
  }

  const [feedA, feedB] = feeders;
  const feedMatchA = resolved.get(feedA);
  const feedMatchB = resolved.get(feedB);

  // Only fill later rounds once both feeder matches are finished with a winner.
  if (
    !feedMatchA ||
    !feedMatchB ||
    !isKnockoutComplete(feedMatchA.status) ||
    !isKnockoutComplete(feedMatchB.status)
  ) {
    return placeholderMatch(slotId, roundId);
  }

  const w1 = feedMatchA.winner;
  const w2 = feedMatchB.winner;
  if (!w1 || !w2) {
    return placeholderMatch(slotId, roundId);
  }

  const direct = pool.find((m) => m.id === slotId && m.roundId === roundId);
  if (direct?.home && direct.away && teamsMatch(direct, w1, w2)) {
    return { ...direct, id: slotId };
  }

  const fromPool = pool.find(
    (m) => m.roundId === roundId && teamsMatch(m, w1, w2),
  );
  if (fromPool) {
    return { ...fromPool, id: slotId };
  }

  const slotMeta = pool.find((m) => m.id === slotId);

  return {
    id: slotId,
    roundId,
    stage: ROUND_LABELS[roundId]?.stage ?? "",
    home: w1,
    away: w2,
    homeScore: null,
    awayScore: null,
    homePenalty: null,
    awayPenalty: null,
    status: "scheduled",
    kickoff: slotMeta?.kickoff ?? null,
    winner: null,
  };
}

function ingestFifaKnockoutMatches(
  fifaRounds: FifaRoundRow[],
  matchesById: Map<number, WcMatchRow>,
): { resolved: Map<number, BracketMatch>; pool: BracketMatch[] } {
  const resolved = new Map<number, BracketMatch>();
  const pool: BracketMatch[] = [];

  for (const round of fifaRounds) {
    if (!KNOCKOUT_ROUND_IDS.includes(round.id as (typeof KNOCKOUT_ROUND_IDS)[number])) {
      continue;
    }
    for (const t of round.tournaments ?? []) {
      const roundId = round.id;
      const match = mergeBracketMatch(
        fromFifaTournament(t, roundId),
        matchesById.get(t.id),
      );
      pool.push(match);
      resolved.set(t.id, match);
    }
  }

  for (const m of matchesById.values()) {
    if (
      KNOCKOUT_ROUND_IDS.includes(m.round_id as (typeof KNOCKOUT_ROUND_IDS)[number]) &&
      !resolved.has(m.id)
    ) {
      const match = fromWcMatchRow(m);
      pool.push(match);
      resolved.set(m.id, match);
    }
  }

  return { resolved, pool };
}

export function buildKnockoutBracket(
  fifaRounds: FifaRoundRow[],
  matchesById: Map<number, WcMatchRow>,
  locale: string,
): KnockoutBracket | null {
  const r32 = fifaRounds.find((r) => r.id === 4);
  if (!r32?.tournaments?.length) return null;

  const isZh = locale.toLowerCase().startsWith("zh");
  const { resolved, pool } = ingestFifaKnockoutMatches(fifaRounds, matchesById);
  const built: BracketRound[] = [];

  for (const roundId of KNOCKOUT_ROUND_IDS) {
    const meta = ROUND_LABELS[roundId];
    const order = WC2026_ROUND_ORDER[roundId];
    if (!order?.length) continue;

    const matches = order.map((slotId) => {
      const match = resolveSlotMatch(slotId, roundId, resolved, pool);
      resolved.set(slotId, match);
      return match;
    });

    built.push({
      roundId,
      stage: meta.stage,
      label: isZh ? meta.zh : meta.en,
      matches,
    });
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
