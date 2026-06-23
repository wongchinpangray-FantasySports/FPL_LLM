import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getWcMiniMatchdayContext } from "@/lib/wc-mini/matchday";
import { buildWcMatchdayStats, scoreWcMiniSquad } from "@/lib/wc-mini/scoring";
import type { WcMiniEntryRow, WcMiniPickStored } from "@/lib/wc-mini/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ctx = await getWcMiniMatchdayContext();
  const mdParam = searchParams.get("matchday");
  const matchday =
    mdParam != null && mdParam !== ""
      ? Number(mdParam)
      : ctx.scoring_matchday;

  if (!Number.isInteger(matchday) || matchday < 1) {
    return NextResponse.json({ error: "Invalid matchday" }, { status: 400 });
  }

  const supa = getServerSupabase();
  const { data: entries, error: eErr } = await supa
    .from("wc_mini_entries")
    .select(
      "entry_tag,matchday,season,entry_name,picks,captain_player_id,vice_player_id,updated_at",
    )
    .eq("matchday", matchday)
    .eq("season", ctx.season);

  if (eErr) {
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  const rows = (entries ?? []) as WcMiniEntryRow[];
  const allPlayerIds = new Set<number>();
  for (const row of rows) {
    for (const p of row.picks as WcMiniPickStored[]) {
      allPlayerIds.add(p.fpl_id);
    }
  }

  const statsByPlayer = await buildWcMatchdayStats(matchday, [...allPlayerIds]);

  const leaderboard = rows
    .map((row) => {
      const picks = row.picks as WcMiniPickStored[];
      const pickIds = picks.map((p) => p.fpl_id);
      const scored = scoreWcMiniSquad(
        pickIds,
        row.captain_player_id,
        row.vice_player_id,
        statsByPlayer,
      );
      const capPick = picks.find((p) => p.fpl_id === row.captain_player_id);
      return {
        entry_tag: row.entry_tag,
        entry_name: row.entry_name,
        total_points: scored.total,
        captain_name: capPick?.web_name ?? null,
        picks,
        updated_at: row.updated_at,
      };
    })
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        a.entry_tag.localeCompare(b.entry_tag),
    )
    .map((row, i) => ({ rank: i + 1, ...row }));

  return NextResponse.json({
    matchday,
    season: ctx.season,
    scoring_matchday: ctx.scoring_matchday,
    submission_matchday: ctx.submission_matchday,
    submission_open: ctx.submission_open,
    deadline_time: ctx.deadline_time,
    scoring_finished: ctx.scoring_finished,
    updated_at: new Date().toISOString(),
    rows: leaderboard,
  });
}
