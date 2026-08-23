import { NextResponse } from "next/server";
import { loadPlayerHubData } from "@/lib/player-hub";
import { loadPlayerGwHistoryWithFixtures } from "@/lib/player-gw-history";
import { loadPlayerShotMapCached } from "@/lib/fpl/understat-shots";
import { loadPlayerPriceForecast } from "@/lib/fpl/insights/price-forecast";
import { loadPlayerLiveSeasonStats } from "@/lib/player-live-stats";
import {
  formatFplSeasonDisplay,
  getCurrentFplSeason,
} from "@/lib/fpl-season";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function loadTeamShort(teamId: number | null): Promise<string | null> {
  if (teamId == null || teamId <= 0) return null;
  const supa = getServerSupabase();
  const { data } = await supa
    .from("teams")
    .select("short_name")
    .eq("id", teamId)
    .maybeSingle();
  const short = data?.short_name;
  return short ? String(short).toUpperCase() : null;
}

function pickSeasonField<T>(
  live: T | null | undefined,
  db: T | null | undefined,
): T | null {
  if (live != null) return live;
  if (db != null) return db;
  return null;
}

/** Public lightweight profile for Insights popups (no radar compare). */
export async function GET(
  req: Request,
  { params }: { params: { fplId: string } },
) {
  const fplId = Number(params.fplId);
  if (!Number.isFinite(fplId) || fplId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const horizon = Math.min(
    8,
    Math.max(1, Number(url.searchParams.get("horizon")) || 5),
  );

  const hub = await loadPlayerHubData(fplId, horizon);
  if (!hub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { static: row, projection: p, currentGw, fromGw, toGw } = hub;
  const seasonKey = await getCurrentFplSeason();

  const [recentGws, shotMap, priceForecast, teamShort, liveSeason] =
    await Promise.all([
      loadPlayerGwHistoryWithFixtures(
        fplId,
        row.team_id,
        8,
        seasonKey,
        row.position,
      ),
      loadPlayerShotMapCached(fplId).catch(() => null),
      loadPlayerPriceForecast(fplId).catch(() => null),
      loadTeamShort(row.team_id),
      loadPlayerLiveSeasonStats(fplId).catch(() => null),
    ]);

  const seasonSource = liveSeason ? "live" : "db";

  return NextResponse.json({
    fpl_id: fplId,
    display_name: row.web_name ?? row.name ?? `#${fplId}`,
    team: row.team,
    team_short: teamShort,
    position: row.position,
    price: row.base_price,
    form: row.form,
    ownership: row.selected_by_percent,
    status: row.status,
    chance_of_playing: row.chance_of_playing,
    news: row.news,
    season_label: formatFplSeasonDisplay(seasonKey),
    season: {
      source: seasonSource,
      total_points: pickSeasonField(
        liveSeason?.total_points,
        row.total_points,
      ),
      minutes: pickSeasonField(liveSeason?.minutes, row.minutes),
      goals: pickSeasonField(liveSeason?.goals, row.goals_scored),
      assists: pickSeasonField(liveSeason?.assists, row.assists),
      clean_sheets: pickSeasonField(
        liveSeason?.clean_sheets,
        row.clean_sheets,
      ),
      bonus: pickSeasonField(liveSeason?.bonus, row.bonus),
      ict_index: pickSeasonField(liveSeason?.ict_index, row.ict_index),
      threat: pickSeasonField(liveSeason?.threat, row.threat),
      influence: pickSeasonField(liveSeason?.influence, row.influence),
      creativity: pickSeasonField(liveSeason?.creativity, row.creativity),
      expected_goals: pickSeasonField(
        liveSeason?.expected_goals,
        row.expected_goals,
      ),
      expected_assists: pickSeasonField(
        liveSeason?.expected_assists,
        row.expected_assists,
      ),
      defensive_contribution: pickSeasonField(
        liveSeason?.defensive_contribution,
        row.defensive_contribution,
      ),
      defensive_contribution_per_90: pickSeasonField(
        liveSeason?.defensive_contribution_per_90,
        row.defensive_contribution_per_90,
      ),
      points_per_game: pickSeasonField(
        liveSeason?.points_per_game,
        row.points_per_game,
      ),
    },
    model: {
      current_gw: currentGw,
      from_gw: fromGw,
      to_gw: toGw,
      xp_total: p.xp_total,
      xp_per_game: p.xp_per_game,
      value_per_million: p.value_per_million,
      availability: p.availability,
      availability_note: p.availability_note,
      fixtures: p.fixtures.map((f) => ({
        gw: f.gw,
        opp: f.opp_short,
        home: f.home,
        fdr: f.fdr,
        expected_minutes: f.expected_minutes,
        xp: f.xp_total,
      })),
    },
    recent_gws: recentGws,
    shot_map: shotMap,
    price_forecast: priceForecast,
  });
}
