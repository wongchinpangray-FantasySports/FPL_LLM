import { NextResponse } from "next/server";
import { loadPlayerHubData } from "@/lib/player-hub";
import { loadPlayerGwHistory } from "@/lib/player-gw-history";
import { loadPlayerShotMapCached } from "@/lib/fpl/understat-shots";

export const dynamic = "force-dynamic";

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

  const [hub, recentGws, shotMap] = await Promise.all([
    loadPlayerHubData(fplId, horizon),
    loadPlayerGwHistory(fplId, 8),
    loadPlayerShotMapCached(fplId).catch(() => null),
  ]);

  if (!hub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { static: row, projection: p, currentGw, fromGw, toGw } = hub;

  return NextResponse.json({
    fpl_id: fplId,
    display_name: row.web_name ?? row.name ?? `#${fplId}`,
    team: row.team,
    position: row.position,
    price: row.base_price,
    form: row.form,
    ownership: row.selected_by_percent,
    status: row.status,
    chance_of_playing: row.chance_of_playing,
    news: row.news,
    season: {
      total_points: row.total_points,
      minutes: row.minutes,
      goals: row.goals_scored,
      assists: row.assists,
      clean_sheets: row.clean_sheets,
      bonus: row.bonus,
      ict_index: row.ict_index,
      threat: row.threat,
      influence: row.influence,
      creativity: row.creativity,
      expected_goals: row.expected_goals,
      expected_assists: row.expected_assists,
      defensive_contribution: row.defensive_contribution,
      defensive_contribution_per_90: row.defensive_contribution_per_90,
      points_per_game: row.points_per_game,
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
  });
}
