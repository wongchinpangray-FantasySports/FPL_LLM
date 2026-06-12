import { getServerSupabase } from "@/lib/supabase";
import { buildWcMatchSchedule, type WcMatchRow } from "@/lib/wc/fifa-rounds";

export async function buildWcMatchesWithStats(): Promise<{
  rounds: number[];
  matches: WcMatchRow[];
}> {
  return buildWcMatchSchedule();
}

/** Cache FIFA schedule/scores in Supabase (optional cron). */
export async function syncWcMatchStats(): Promise<{
  schedule_upserted: number;
}> {
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

  return { schedule_upserted: scheduleRows.length };
}
