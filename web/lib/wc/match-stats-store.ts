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
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";

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

  const cached = await loadCachedMatchEvents();
  const hit = cached.get(match.id);
  if (hit && hasTimeline({ ...match, ...hit })) {
    return mergeCachedEvents([match], cached)[0] ?? match;
  }

  const events = await fetchMatchEvents(match);
  if (!events) return null;

  return persistMatchEvents(match, events);
}

/** Cache FIFA schedule/scores; enrich finished matches with goal/card timeline. */
export async function syncWcMatchStats(opts?: {
  eventsLimit?: number;
}): Promise<{
  schedule_upserted: number;
  events_enriched: number;
  events_skipped: number;
}> {
  const limit = Math.min(12, Math.max(0, opts?.eventsLimit ?? 8));
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

  if (!isApiFootballConfigured() || limit === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      events_enriched: 0,
      events_skipped: 0,
    };
  }

  const finished = matches.filter(isWcMatchFinished);
  if (finished.length === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      events_enriched: 0,
      events_skipped: 0,
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
  };
}
