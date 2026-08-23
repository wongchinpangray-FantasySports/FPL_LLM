import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import {
  computeMatchdayRefresh,
  getTeamsPlayedOnDate,
  type MiniFixtureRow,
} from "@/lib/mini/matchday";
import { scoreMiniSquad, scoreMiniSquadFiltered } from "@/lib/mini/scoring";
import { getMiniOwnershipSnapshot } from "@/lib/mini/hot-picks";
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
  const { data: fixtureRows } = await supa
    .from("fixtures")
    .select("kickoff_time,home_team_id,away_team_id,finished")
    .eq("gw", gw)
    .eq("season", season);

  const fixtures = (fixtureRows ?? []) as MiniFixtureRow[];
  const matchday = computeMatchdayRefresh(fixtures, ctx.scoring_finished);
  const yesterdayTeams = matchday.yesterday_has_scores
    ? getTeamsPlayedOnDate(fixtures, matchday.yesterday_date)
    : new Set<number>();

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

  let ownedById: Record<number, number> = {};
  let miniEntries = rows.length;
  try {
    const snap = await getMiniOwnershipSnapshot(gw, season);
    ownedById = snap.owned_by_id;
    miniEntries = snap.entries;
  } catch {
    /* ownership optional */
  }

  const leaderboard = rows
    .map((row) => {
      const picks = row.picks as MiniPickStored[];
      const pickIds = picks.map((p) => p.fpl_id);
      const fplOwnedById: Record<number, number> = {};
      for (const p of picks) {
        if (p.selected_by_percent != null) {
          fplOwnedById[p.fpl_id] = p.selected_by_percent;
        }
      }
      const scored = scoreMiniSquad(
        pickIds,
        row.captain_fpl_id,
        row.vice_fpl_id,
        statsByPlayer,
        {
          miniOwnedById: ownedById,
          fplOwnedById,
          miniEntries,
        },
      );
      const pickTeamById = new Map(
        picks.map((p) => [p.fpl_id, p.team_id] as const),
      );
      const yesterdayScored =
        yesterdayTeams.size > 0
          ? scoreMiniSquadFiltered(
              pickIds,
              row.captain_fpl_id,
              row.vice_fpl_id,
              statsByPlayer,
              yesterdayTeams,
              {
                miniOwnedById: ownedById,
                fplOwnedById,
                miniEntries,
              },
              pickTeamById,
            )
          : null;
      const capPick = picks.find((p) => p.fpl_id === row.captain_fpl_id);
      const vicePick = picks.find((p) => p.fpl_id === row.vice_fpl_id);
      const gwPointsByFplId = Object.fromEntries(
        scored.breakdown.map((b) => [b.player_id, b.scored_points]),
      );
      return {
        entry_id: row.entry_id,
        entry_name: row.entry_name,
        total_points: scored.total,
        yesterday_points: yesterdayScored?.total ?? null,
        captain_fpl_id: row.captain_fpl_id,
        vice_fpl_id: row.vice_fpl_id,
        doubled_player_id: scored.doubled_player_id,
        differential_bonus: scored.differential_bonus,
        differential_captain: scored.differential_captain,
        captain_name: capPick?.web_name ?? null,
        vice_name: vicePick?.web_name ?? null,
        picks,
        breakdown: scored.breakdown,
        gw_points_by_fpl_id: gwPointsByFplId,
        updated_at: row.updated_at,
      };
    })
    .sort((a, b) => b.total_points - a.total_points || a.entry_id - b.entry_id)
    .map((row, i) => ({ rank: i + 1, ...row }));

  return NextResponse.json(
    {
      gw,
      season,
      scoring_gw: ctx.scoring_gw,
      submission_gw: ctx.submission_gw,
      submission_open: ctx.submission_open,
      deadline_time: ctx.deadline_time,
      scoring_finished: ctx.scoring_finished,
      next_refresh_at: matchday.next_refresh_at,
      yesterday_date: matchday.yesterday_date,
      yesterday_has_scores: matchday.yesterday_has_scores,
      updated_at: new Date().toISOString(),
      rows: leaderboard,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
