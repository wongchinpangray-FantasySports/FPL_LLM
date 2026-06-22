import { getServerSupabase } from "@/lib/supabase";
import {
  fetchMatchEvents,
  isApiFootballConfigured,
} from "@/lib/wc/api-football-events";
import {
  buildWcMatchSchedule,
  isWcMatchFinished,
  normalizeMatchCards,
  normalizeMatchGoals,
  wcRoundLabel,
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";
import { syncWcFixtureStatus } from "@/lib/wc/projection-context";

type EventsRow = {
  fifa_tournament_id: number;
  home_goals: WcMatchRow["home_goals"];
  away_goals: WcMatchRow["away_goals"];
  home_cards: WcMatchRow["home_cards"];
  away_cards: WcMatchRow["away_cards"];
  events_source: string | null;
};

function hasTimeline(m: WcMatchRow): boolean {
  const goals = [...(m.home_goals ?? []), ...(m.away_goals ?? [])];
  const cards = [...(m.home_cards ?? []), ...(m.away_cards ?? [])];
  return goals.some((g) => g.minute) || cards.length > 0;
}

export async function loadCachedMatchEvents(): Promise<Map<number, EventsRow>> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_match_stats")
    .select(
      "fifa_tournament_id, home_goals, away_goals, home_cards, away_cards, stats_source",
    );
  if (error) throw new Error(error.message);

  const map = new Map<number, EventsRow>();
  for (const row of data ?? []) {
    map.set(row.fifa_tournament_id as number, {
      fifa_tournament_id: row.fifa_tournament_id as number,
      home_goals: normalizeMatchGoals(row.home_goals),
      away_goals: normalizeMatchGoals(row.away_goals),
      home_cards: normalizeMatchCards(row.home_cards),
      away_cards: normalizeMatchCards(row.away_cards),
      events_source: (row.stats_source as string | null) ?? null,
    });
  }
  return map;
}

/** Supabase fallback when live FIFA rounds.json is unavailable. */
export async function loadScheduleMatchesFromCache(): Promise<WcMatchRow[]> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_match_stats")
    .select(
      "fifa_tournament_id, round_id, kickoff, venue, venue_city, status, period, minutes, extra_minutes, home_code, away_code, home_name, away_name, home_score, away_score, home_scorers, away_scorers, home_goals, away_goals, home_cards, away_cards",
    )
    .order("kickoff", { ascending: true, nullsFirst: false });
  if (error || !data?.length) return [];

  return data.map((row) => {
    const roundId = row.round_id as number;
    return {
      id: row.fifa_tournament_id as number,
      round_id: roundId,
      round_label: wcRoundLabel(roundId),
      round_stage: null,
      kickoff: (row.kickoff as string | null) ?? null,
      venue: (row.venue as string | null) ?? null,
      venue_city: (row.venue_city as string | null) ?? null,
      status: (row.status as string) ?? "scheduled",
      period: (row.period as string | null) ?? null,
      minutes: Number(row.minutes ?? 0),
      extra_minutes: Number(row.extra_minutes ?? 0),
      home_squad_id: 0,
      away_squad_id: 0,
      home_code: row.home_code as string,
      away_code: row.away_code as string,
      home_name: row.home_name as string,
      away_name: row.away_name as string,
      home_score: row.home_score as number | null,
      away_score: row.away_score as number | null,
      home_penalty_score: null,
      away_penalty_score: null,
      home_scorers: (row.home_scorers as string | null) ?? null,
      away_scorers: (row.away_scorers as string | null) ?? null,
      home_goals: normalizeMatchGoals(row.home_goals),
      away_goals: normalizeMatchGoals(row.away_goals),
      home_cards: normalizeMatchCards(row.home_cards),
      away_cards: normalizeMatchCards(row.away_cards),
      stats_available: false,
      home_stats: null,
      away_stats: null,
    } satisfies WcMatchRow;
  });
}

export function mergeCachedEvents(
  matches: WcMatchRow[],
  cached: Map<number, EventsRow>,
): WcMatchRow[] {
  return matches.map((m) => {
    const hit = cached.get(m.id);
    if (!hit) return m;

    const hasGoals =
      hit.home_goals.length > 0 ||
      hit.away_goals.length > 0 ||
      hit.home_cards.length > 0 ||
      hit.away_cards.length > 0;
    if (!hasGoals) return m;

    return {
      ...m,
      home_goals: hit.home_goals.length > 0 ? hit.home_goals : m.home_goals,
      away_goals: hit.away_goals.length > 0 ? hit.away_goals : m.away_goals,
      home_cards: hit.home_cards.length > 0 ? hit.home_cards : m.home_cards,
      away_cards: hit.away_cards.length > 0 ? hit.away_cards : m.away_cards,
    };
  });
}

export async function buildWcMatchesWithStats(): Promise<{
  rounds: number[];
  matches: WcMatchRow[];
  events_provider: string | null;
}> {
  const [{ rounds, matches }, cached] = await Promise.all([
    buildWcMatchSchedule(),
    loadCachedMatchEvents().catch(() => new Map<number, EventsRow>()),
  ]);
  return {
    rounds,
    matches: mergeCachedEvents(matches, cached),
    events_provider:
      cached.size > 0
        ? "cache"
        : isApiFootballConfigured()
          ? "api-football"
          : null,
  };
}

/** Live FIFA schedule with Supabase fallback (retries on transient failures). */
export async function loadWcMatchesForDisplay(): Promise<WcMatchRow[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { matches } = await buildWcMatchesWithStats();
      if (matches.length > 0) return matches;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      }
    }
  }
  return loadScheduleMatchesFromCache();
}

function pickGoals(
  fifa: WcMatchGoal[],
  api: WcMatchGoal[],
): WcMatchGoal[] {
  if (api.some((g) => g.minute)) return api;
  return fifa.length > 0 ? fifa : api;
}

async function persistMatchEvents(
  match: WcMatchRow,
  events: NonNullable<Awaited<ReturnType<typeof fetchMatchEvents>>>,
): Promise<WcMatchRow> {
  const home_goals = pickGoals(match.home_goals, events.home_goals);
  const away_goals = pickGoals(match.away_goals, events.away_goals);
  const home_cards = events.home_cards;
  const away_cards = events.away_cards;

  const supa = getServerSupabase();
  await supa.from("wc_match_stats").upsert(
    {
      fifa_tournament_id: match.id,
      round_id: match.round_id,
      kickoff: match.kickoff,
      venue: match.venue,
      venue_city: match.venue_city,
      status: match.status,
      period: match.period,
      minutes: match.minutes,
      extra_minutes: match.extra_minutes,
      home_code: match.home_code,
      away_code: match.away_code,
      home_name: match.home_name,
      away_name: match.away_name,
      home_score: match.home_score,
      away_score: match.away_score,
      home_scorers: match.home_scorers,
      away_scorers: match.away_scorers,
      home_goals,
      away_goals,
      home_cards,
      away_cards,
      stats_source: "api-football",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fifa_tournament_id" },
  );

  return {
    ...match,
    home_goals,
    away_goals,
    home_cards,
    away_cards,
  };
}

/** Fetch goal/card timeline from API-Football and cache in Supabase. */
export async function fetchAndCacheMatchEvents(
  match: WcMatchRow,
): Promise<WcMatchRow | null> {
  if (!isApiFootballConfigured() || !isWcMatchFinished(match)) {
    return null;
  }

  try {
    const cached = await loadCachedMatchEvents();
    const hit = cached.get(match.id);
    if (hit && hasTimeline({ ...match, ...hit })) {
      return mergeCachedEvents([match], cached)[0] ?? match;
    }

    const events = await fetchMatchEvents(match);
    if (!events) return null;

    return persistMatchEvents(match, events);
  } catch {
    return null;
  }
}

/** Cache FIFA schedule/scores; enrich finished matches with goal/card timeline. */
export async function syncWcMatchStats(opts?: {
  eventsLimit?: number;
}): Promise<{
  schedule_upserted: number;
  events_enriched: number;
  events_skipped: number;
  fixtures_updated: number;
}> {
  const envLimit = Number(process.env.WC_MATCH_EVENTS_LIMIT ?? "8");
  const limit = Math.min(
    128,
    Math.max(0, opts?.eventsLimit ?? envLimit),
  );
  const { matches } = await buildWcMatchSchedule();
  const supa = getServerSupabase();

  const scheduleRows = matches.map((m) => ({
    fifa_tournament_id: m.id,
    round_id: m.round_id,
    kickoff: m.kickoff,
    venue: m.venue,
    venue_city: m.venue_city,
    status: m.status,
    period: m.period,
    minutes: m.minutes,
    extra_minutes: m.extra_minutes,
    home_code: m.home_code,
    away_code: m.away_code,
    home_name: m.home_name,
    away_name: m.away_name,
    home_score: m.home_score,
    away_score: m.away_score,
    home_scorers: m.home_scorers,
    away_scorers: m.away_scorers,
    home_goals: m.home_goals.length > 0 ? m.home_goals : null,
    away_goals: m.away_goals.length > 0 ? m.away_goals : null,
    updated_at: new Date().toISOString(),
  }));

  const BATCH = 50;
  for (let i = 0; i < scheduleRows.length; i += BATCH) {
    const chunk = scheduleRows.slice(i, i + BATCH);
    const { error } = await supa
      .from("wc_match_stats")
      .upsert(chunk, { onConflict: "fifa_tournament_id" });
    if (error) throw new Error(error.message);
  }

  let events_enriched = 0;
  let events_skipped = 0;
  let fixtures_updated = 0;
  try {
    fixtures_updated = await syncWcFixtureStatus();
  } catch {
    /* non-fatal */
  }

  if (!isApiFootballConfigured() || limit === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      events_enriched: 0,
      events_skipped: 0,
      fixtures_updated,
    };
  }

  const finished = matches.filter(isWcMatchFinished);
  if (finished.length === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      events_enriched: 0,
      events_skipped: 0,
      fixtures_updated,
    };
  }

  const cached = await loadCachedMatchEvents();
  const merged = mergeCachedEvents(finished, cached);
  const candidates = merged
    .filter((m) => !hasTimeline(m))
    .slice(0, limit);

  for (const base of candidates) {
    const events = await fetchMatchEvents(base);
    if (!events) {
      events_skipped++;
      continue;
    }
    await persistMatchEvents(base, events);
    events_enriched++;
  }

  return {
    schedule_upserted: scheduleRows.length,
    events_enriched,
    events_skipped,
    fixtures_updated,
  };
}
