import { NextResponse } from "next/server";
import { loadPlayerGwHistory } from "@/lib/player-gw-history";
import type { FixtureProjection } from "@/lib/xp";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";
import { getServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round(n: number, d = 2): number {
  const p = Math.pow(10, d);
  return Math.round(n * p) / p;
}

function serializeFixture(f: FixtureProjection) {
  return {
    gw: f.gw,
    opp_short: f.opp_short,
    home: f.home,
    fdr: f.fdr,
    xp_total: round(f.xp_total, 2),
    expected_minutes: round(f.expected_minutes, 0),
    xG: round(f.xG, 2),
    xA: round(f.xA, 2),
    p_clean_sheet: round(f.p_clean_sheet, 2),
    opp_history_mult: round(f.opp_history_mult, 2),
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const fplId = Number(url.searchParams.get("fplId"));
    const horizon = Math.min(
      8,
      Math.max(1, Number(url.searchParams.get("horizon")) || 5),
    );
    if (!Number.isFinite(fplId) || fplId <= 0) {
      return NextResponse.json({ error: "Invalid fplId" }, { status: 400 });
    }

    const { current } = await resolveCurrentGw();
    const fromGw = current + 1;
    const toGw = fromGw + horizon - 1;

    const projections = await projectPlayers([fplId], {
      currentGw: current,
      fromGw,
      toGw,
    });
    const p = projections.get(fplId);
    if (!p) {
      return NextResponse.json(
        { error: "Player not found or could not project fixtures." },
        { status: 404 },
      );
    }

    const supa = getServerSupabase();
    const [{ data: extra }, recentGameweeks] = await Promise.all([
      supa
        .from("players_static")
        .select(
          "news,transfers_in_event,transfers_out_event,ict_index,total_points,minutes,goals_scored,assists",
        )
        .eq("fpl_id", fplId)
        .maybeSingle(),
      loadPlayerGwHistory(fplId, 10),
    ]);

    return NextResponse.json({
      currentGw: current,
      fromGw,
      toGw,
      horizon,
      profile: {
        fpl_id: p.fpl_id,
        web_name: p.web_name,
        team: p.team,
        position: p.position,
        price: p.price,
        form: p.form,
        ownership: p.ownership,
        total_points: extra?.total_points ?? null,
        minutes_season: extra?.minutes ?? null,
        goals_scored: extra?.goals_scored ?? null,
        assists: extra?.assists ?? null,
        ict_index: extra?.ict_index ?? null,
        news: extra?.news ?? null,
        transfers_in_event: extra?.transfers_in_event ?? null,
        transfers_out_event: extra?.transfers_out_event ?? null,
      },
      availability: {
        p: p.availability,
        note: p.availability_note,
      },
      setPieces: p.set_pieces,
      rolling: p.rolling,
      fixtures: p.fixtures.map(serializeFixture),
      xp_total: p.xp_total,
      xp_per_game: p.xp_per_game,
      value_per_million: p.value_per_million,
      recentGameweeks,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load player";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
