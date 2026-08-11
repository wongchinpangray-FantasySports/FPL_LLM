import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { scoreMiniSquad } from "@/lib/mini/scoring";
import type { MiniEntryRow, MiniPickStored } from "@/lib/mini/types";

export interface SeasonLadderRow {
  rank: number;
  entry_id: number;
  profile_id: string | null;
  entry_name: string | null;
  total_points: number;
  gws_played: number;
}

/** Sum Mini 5 GW points across the season (finished/live GWs with stats). */
export async function buildSeasonLadder(opts?: {
  profileIds?: string[];
  limit?: number;
}): Promise<{ season: string; rows: SeasonLadderRow[] }> {
  const supa = getServerSupabase();
  const season = await getCurrentFplSeason();
  const limit = opts?.limit ?? 100;

  let q = supa
    .from("mini_entries")
    .select(
      "entry_id,gw,season,entry_name,profile_id,picks,captain_fpl_id,vice_fpl_id,updated_at",
    )
    .eq("season", season);

  if (opts?.profileIds?.length) {
    q = q.in("profile_id", opts.profileIds);
  }

  let entries: Array<Record<string, unknown>> | null = null;
  let error: { message: string } | null = null;

  {
    const first = await q;
    entries = (first.data as Array<Record<string, unknown>> | null) ?? null;
    error = first.error;
  }

  if (error && /profile_id|schema cache|does not exist/i.test(error.message)) {
    if (opts?.profileIds?.length) {
      throw new Error("Mini leagues need migration 0028_mini_gamification.sql");
    }
    const fallback = await supa
      .from("mini_entries")
      .select(
        "entry_id,gw,season,entry_name,picks,captain_fpl_id,vice_fpl_id,updated_at",
      )
      .eq("season", season);
    entries = (fallback.data as Array<Record<string, unknown>> | null) ?? null;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  const rows = (entries ?? []) as unknown as Array<
    MiniEntryRow & { profile_id?: string | null }
  >;
  if (rows.length === 0) {
    return { season, rows: [] };
  }

  const gws = [...new Set(rows.map((r) => r.gw))];
  const allPlayerIds = new Set<number>();
  for (const row of rows) {
    for (const p of row.picks as MiniPickStored[]) allPlayerIds.add(p.fpl_id);
  }

  const statsByGw = new Map<
    number,
    Map<number, { player_id: number; total_points: number | null; minutes: number | null }>
  >();

  if (allPlayerIds.size > 0 && gws.length > 0) {
    const { data: stats, error: sErr } = await supa
      .from("player_gw_stats")
      .select("gw,player_id,total_points,minutes")
      .eq("season", season)
      .in("gw", gws)
      .in("player_id", [...allPlayerIds]);
    if (sErr) throw new Error(sErr.message);
    for (const s of stats ?? []) {
      const gw = s.gw as number;
      if (!statsByGw.has(gw)) statsByGw.set(gw, new Map());
      statsByGw.get(gw)!.set(s.player_id as number, {
        player_id: s.player_id as number,
        total_points: s.total_points as number | null,
        minutes: s.minutes as number | null,
      });
    }
  }

  const byKey = new Map<
    string,
    {
      entry_id: number;
      profile_id: string | null;
      entry_name: string | null;
      total_points: number;
      gws_played: number;
    }
  >();

  for (const row of rows) {
    const key = row.profile_id
      ? `p:${row.profile_id}`
      : `e:${row.entry_id}`;
    const pickIds = (row.picks as MiniPickStored[]).map((p) => p.fpl_id);
    const scored = scoreMiniSquad(
      pickIds,
      row.captain_fpl_id,
      row.vice_fpl_id,
      statsByGw.get(row.gw) ?? new Map(),
    );
    const cur = byKey.get(key) ?? {
      entry_id: row.entry_id,
      profile_id: row.profile_id ?? null,
      entry_name: row.entry_name,
      total_points: 0,
      gws_played: 0,
    };
    cur.total_points += scored.total;
    cur.gws_played += 1;
    if (row.entry_name) cur.entry_name = row.entry_name;
    byKey.set(key, cur);
  }

  const ladder = [...byKey.values()]
    .sort(
      (a, b) =>
        b.total_points - a.total_points ||
        b.gws_played - a.gws_played ||
        a.entry_id - b.entry_id,
    )
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, ...row }));

  return { season, rows: ladder };
}
