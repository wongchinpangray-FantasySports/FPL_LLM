import { getServerSupabase } from "@/lib/supabase";
import {
  fetchMatchOptaStats,
  fetchMatchEvents,
  isApiFootballConfigured,
} from "@/lib/wc/api-football-stats";
import {
  buildWcMatchSchedule,
  isWcMatchFinished,
  normalizeMatchCards,
  normalizeMatchGoals,
  normalizeTeamMatchStats,
  type WcMatchRow,
  type WcTeamMatchStats,
} from "@/lib/wc/fifa-rounds";

type StatsRow = {
  fifa_tournament_id: number;
  home_stats: WcTeamMatchStats | null;
  away_stats: WcTeamMatchStats | null;
  stats_source: string | null;
  home_goals: WcMatchRow["home_goals"];
  away_goals: WcMatchRow["away_goals"];
  home_cards: WcMatchRow["home_cards"];
  away_cards: WcMatchRow["away_cards"];
};

function isFinished(m: WcMatchRow): boolean {
  return isWcMatchFinished(m);
}

export async function loadCachedMatchStats(): Promise<Map<number, StatsRow>> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_match_stats")
    .select(
      "fifa_tournament_id, home_stats, away_stats, stats_source, home_goals, away_goals, home_cards, away_cards",
    );
  if (error) throw new Error(error.message);

  const map = new Map<number, StatsRow>();
  for (const row of data ?? []) {
    map.set(row.fifa_tournament_id as number, {
      fifa_tournament_id: row.fifa_tournament_id as number,
      home_stats: normalizeTeamMatchStats(row.home_stats),
      away_stats: normalizeTeamMatchStats(row.away_stats),
      stats_source: (row.stats_source as string | null) ?? null,
      home_goals: normalizeMatchGoals(row.home_goals),
      away_goals: normalizeMatchGoals(row.away_goals),
      home_cards: normalizeMatchCards(row.home_cards),
      away_cards: normalizeMatchCards(row.away_cards),
    });
  }
  return map;
}

export function mergeCachedStats(
  matches: WcMatchRow[],
  cached: Map<number, StatsRow>,
): WcMatchRow[] {
  return matches.map((m) => {
    const hit = cached.get(m.id);
    if (!hit) return m;
    const hasStats = hit.home_stats && hit.away_stats;
    const hasGoals =
      hit.home_goals.length > 0 ||
      hit.away_goals.length > 0 ||
      hit.home_cards.length > 0 ||
      hit.away_cards.length > 0;
    if (!hasStats && !hasGoals) return m;
    return {
      ...m,
      stats_available: Boolean(hasStats),
      home_stats: hit.home_stats ?? m.home_stats,
      away_stats: hit.away_stats ?? m.away_stats,
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
  stats_provider: string | null;
}> {
  const [{ rounds, matches }, cached] = await Promise.all([
    buildWcMatchSchedule(),
    loadCachedMatchStats().catch(() => new Map<number, StatsRow>()),
  ]);
  return {
    rounds,
    matches: mergeCachedStats(matches, cached),
    stats_provider:
      cached.size > 0
        ? "cache"
        : isApiFootballConfigured()
          ? "api-football"
          : null,
  };
}

export async function syncWcMatchStats(opts?: {
  statsLimit?: number;
}): Promise<{
  schedule_upserted: number;
  stats_enriched: number;
  stats_skipped: number;
}> {
  const limit = Math.min(12, Math.max(0, opts?.statsLimit ?? 8));
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

  let stats_enriched = 0;
  let stats_skipped = 0;

  if (!isApiFootballConfigured() || limit === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      stats_enriched: 0,
      stats_skipped: 0,
    };
  }

  const finished = matches.filter(isFinished);
  const finishedIdSet = new Set(finished.map((m) => m.id));

  if (finished.length === 0) {
    return {
      schedule_upserted: scheduleRows.length,
      stats_enriched: 0,
      stats_skipped: 0,
    };
  }

  const { data: needStats } = await supa
    .from("wc_match_stats")
    .select(
      "fifa_tournament_id, home_name, away_name, status, home_score, away_score",
    )
    .is("home_stats", null)
    .in("fifa_tournament_id", [...finishedIdSet])
    .limit(limit);

  for (const row of needStats ?? []) {
    const id = row.fifa_tournament_id as number;
    const base = matches.find((m) => m.id === id);
    if (!base || !isFinished(base)) {
      stats_skipped++;
      continue;
    }

    const stats = await fetchMatchOptaStats(base);
    const events = await fetchMatchEvents(base);

    if (!stats && !events) {
      stats_skipped++;
      continue;
    }

    const home_goals =
      events && events.home_goals.length > 0
        ? events.home_goals
        : base.home_goals;
    const away_goals =
      events && events.away_goals.length > 0
        ? events.away_goals
        : base.away_goals;

    const { error } = await supa
      .from("wc_match_stats")
      .update({
        home_stats: stats?.home ?? null,
        away_stats: stats?.away ?? null,
        home_goals,
        away_goals,
        home_cards: events?.home_cards ?? [],
        away_cards: events?.away_cards ?? [],
        stats_source: stats || events ? "api-football" : null,
        updated_at: new Date().toISOString(),
      })
      .eq("fifa_tournament_id", id);

    if (error) stats_skipped++;
    else stats_enriched++;
  }

  return {
    schedule_upserted: scheduleRows.length,
    stats_enriched,
    stats_skipped,
  };
}

export async function fetchAndCacheMatchStats(
  match: WcMatchRow,
): Promise<WcMatchRow | null> {
  const cached = await loadCachedMatchStats();
  const hit = cached.get(match.id);
  if (hit?.home_stats && hit?.away_stats) {
    return {
      ...match,
      stats_available: true,
      home_stats: hit.home_stats,
      away_stats: hit.away_stats,
      home_goals: hit.home_goals.length > 0 ? hit.home_goals : match.home_goals,
      away_goals: hit.away_goals.length > 0 ? hit.away_goals : match.away_goals,
      home_cards: hit.home_cards.length > 0 ? hit.home_cards : match.home_cards,
      away_cards: hit.away_cards.length > 0 ? hit.away_cards : match.away_cards,
    };
  }

  if (!isApiFootballConfigured()) return null;

  const [stats, events] = await Promise.all([
    fetchMatchOptaStats(match),
    fetchMatchEvents(match),
  ]);

  const home_goals =
    events && events.home_goals.length > 0 ? events.home_goals : match.home_goals;
  const away_goals =
    events && events.away_goals.length > 0 ? events.away_goals : match.away_goals;
  const home_cards = events?.home_cards ?? match.home_cards;
  const away_cards = events?.away_cards ?? match.away_cards;

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
      home_stats: stats?.home ?? null,
      away_stats: stats?.away ?? null,
      stats_source: stats || events ? "api-football" : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fifa_tournament_id" },
  );

  return {
    ...match,
    stats_available: Boolean(stats),
    home_stats: stats?.home ?? null,
    away_stats: stats?.away ?? null,
    home_goals,
    away_goals,
    home_cards,
    away_cards,
  };
}
