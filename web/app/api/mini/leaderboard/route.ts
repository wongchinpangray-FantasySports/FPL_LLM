import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { scoreMiniSquad } from "@/lib/mini/scoring";
import type { MiniEntryRow, MiniPickStored } from "@/lib/mini/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gwParam = searchParams.get("gw");
  const ctx = await getMiniGameweekContext();
  const season = await getCurrentFplSeason();
  const gw =
    gwParam != null && gwParam !== ""
      ? Number(gwParam)
      : ctx.scoring_gw;

  if (!Number.isInteger(gw) || gw < 1) {
    return NextResponse.json({ error: "Invalid gw" }, { status: 400 });
  }

  const supa = getServerSupabase();
  const { data: entries, error: eErr } = await supa
    .from("mini_entries")
    .select(
      "entry_id,gw,season,entry_name,picks,captain_fpl_id,vice_fpl_id,updated_at",
    )
    .eq("gw", gw)
    .eq("season", season);

  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  const rows = (entries ?? []) as MiniEntryRow[];
  const allPlayerIds = new Set<number>();
  for (const row of rows) {
    const picks = row.picks as MiniPickStored[];
    for (const p of picks) allPlayerIds.add(p.fpl_id);
  }

  const statsByPlayer = new Map<
    number,
    { player_id: number; total_points: number | null; minutes: number | null }
  >();

  if (allPlayerIds.size > 0) {
    const { data: stats, error: sErr } = await supa
      .from("player_gw_stats")
      .select("player_id,total_points,minutes")
      .eq("gw", gw)
      .eq("season", season)
      .in("player_id", [...allPlayerIds]);

    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }

    for (const s of stats ?? []) {
      statsByPlayer.set(s.player_id as number, {
        player_id: s.player_id as number,
        total_points: s.total_points as number | null,
        minutes: s.minutes as number | null,
      });
    }
  }

  const leaderboard = rows
    .map((row) => {
      const picks = row.picks as MiniPickStored[];
      const pickIds = picks.map((p) => p.fpl_id);
      const scored = scoreMiniSquad(
        pickIds,
        row.captain_fpl_id,
        row.vice_fpl_id,
        statsByPlayer,
      );
      const capPick = picks.find((p) => p.fpl_id === row.captain_fpl_id);
      const vicePick = picks.find((p) => p.fpl_id === row.vice_fpl_id);
      return {
        entry_id: row.entry_id,
        entry_name: row.entry_name,
        total_points: scored.total,
        doubled_player_id: scored.doubled_player_id,
        captain_name: capPick?.web_name ?? null,
        vice_name: vicePick?.web_name ?? null,
        picks,
        breakdown: scored.breakdown,
        updated_at: row.updated_at,
      };
    })
    .sort((a, b) => b.total_points - a.total_points || a.entry_id - b.entry_id)
    .map((row, i) => ({ rank: i + 1, ...row }));

  return NextResponse.json({
    gw,
    season,
    scoring_gw: ctx.scoring_gw,
    submission_gw: ctx.submission_gw,
    submission_open: ctx.submission_open,
    deadline_time: ctx.deadline_time,
    scoring_finished: ctx.scoring_finished,
    updated_at: new Date().toISOString(),
    rows: leaderboard,
  });
}
