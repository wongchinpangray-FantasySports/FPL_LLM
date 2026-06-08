import { getServerSupabase } from "@/lib/supabase";
import {
  fetchMatchOptaStats,
  isApiFootballConfigured,
} from "@/lib/wc/api-football-stats";
import {
  buildWcMatchSchedule,
  type WcMatchRow,
  type WcTeamMatchStats,
} from "@/lib/wc/fifa-rounds";

type StatsRow = {
  fifa_tournament_id: number;
  home_stats: WcTeamMatchStats | null;
  away_stats: WcTeamMatchStats | null;
  stats_source: string | null;
};

function isFinished(m: WcMatchRow): boolean {
  return m.status === "finished" || m.home_score != null;
}

export async function loadCachedMatchStats(): Promise<Map<number, StatsRow>> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_match_stats")
    .select("fifa_tournament_id, home_stats, away_stats, stats_source");
  if (error) throw new Error(error.message);

  const map = new Map<number, StatsRow>();
  for (const row of data ?? []) {
    map.set(row.fifa_tournament_id as number, {
      fifa_tournament_id: row.fifa_tournament_id as number,
      home_stats: row.home_stats as WcTeamMatchStats | null,
      away_stats: row.away_stats as WcTeamMatchStats | null,
      stats_source: (row.stats_source as string | null) ?? null,
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
    if (!hit?.home_stats || !hit?.away_stats) return m;
    return {
      ...m,
      stats_available: true,
      home_stats: hit.home_stats,
      away_stats: hit.away_stats,
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
    if (!stats) {
      stats_skipped++;
      continue;
    }

    const { error } = await supa
      .from("wc_match_stats")
      .update({
        home_stats: stats.home,
        away_stats: stats.away,
        stats_source: "api-football",
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
    };
  }

  if (!isApiFootballConfigured()) return null;
  const stats = await fetchMatchOptaStats(match);
  if (!stats) return null;

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
      home_stats: stats.home,
      away_stats: stats.away,
      stats_source: "api-football",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "fifa_tournament_id" },
  );

  return {
    ...match,
    stats_available: true,
    home_stats: stats.home,
    away_stats: stats.away,
  };
}
