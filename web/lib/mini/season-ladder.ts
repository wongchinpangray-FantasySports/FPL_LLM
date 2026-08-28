import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { scoreMiniSquad } from "@/lib/mini/scoring";
import { getMiniOwnershipSnapshot } from "@/lib/mini/hot-picks";
import type { MiniEntryRow, MiniPickStored } from "@/lib/mini/types";

export interface SeasonGwScore {
  gw: number;
  points: number;
}

export interface SeasonLadderRow {
  rank: number;
  entry_id: number;
  profile_id: string | null;
  entry_name: string | null;
  /** Sum of Mini 5 points across all submitted GWs this season. */
  total_points: number;
  gws_played: number;
  /** Per-GW contribution so the UI can show accumulation clearly. */
  gw_scores: SeasonGwScore[];
}

type GwStat = {
  player_id: number;
  total_points: number | null;
  minutes: number | null;
};

/**
 * Stable season identity via union-find across linked entry_id + profile_id.
 * Same FPL ID or same profile on any row merges into one manager.
 */
function seasonGroupIds(rows: Array<{ entry_id: number; profile_id?: string | null }>): string[] {
  const parent = new Map<string, string>();

  function find(x: string): string {
    let p = parent.get(x) ?? x;
    if (!parent.has(x)) parent.set(x, x);
    while (parent.get(p) !== p) {
      const gp = parent.get(p)!;
      parent.set(p, parent.get(gp) ?? gp);
      p = parent.get(p)!;
    }
    return p;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  function nodeKeys(row: { entry_id: number; profile_id?: string | null }): string[] {
    const keys: string[] = [];
    if (row.entry_id > 0) keys.push(`e:${row.entry_id}`);
    if (row.profile_id) keys.push(`p:${row.profile_id}`);
    if (keys.length === 0) keys.push(`e:${row.entry_id}`);
    return keys;
  }

  for (const row of rows) {
    const keys = nodeKeys(row);
    for (const k of keys) find(k);
    for (let i = 1; i < keys.length; i++) union(keys[0]!, keys[i]!);
  }

  return rows.map((row) => {
    const keys = nodeKeys(row);
    return find(keys[0]!);
  });
}

/** @deprecated Prefer seasonGroupIds for multi-row merge; kept for tests/callers. */
export function seasonIdentityKey(row: {
  entry_id: number;
  profile_id?: string | null;
}): string {
  if (row.entry_id > 0) return `e:${row.entry_id}`;
  if (row.profile_id) return `p:${row.profile_id}`;
  return `e:${row.entry_id}`;
}

async function fetchGwStatsPaged(
  season: string,
  gws: number[],
  playerIds: number[],
): Promise<Map<number, Map<number, GwStat>>> {
  const supa = getServerSupabase();
  const statsByGw = new Map<number, Map<number, GwStat>>();
  if (gws.length === 0 || playerIds.length === 0) return statsByGw;

  const PAGE = 1000;
  let from = 0;
  for (;;) {
    const { data, error } = await supa
      .from("player_gw_stats")
      .select("gw,player_id,total_points,minutes")
      .eq("season", season)
      .in("gw", gws)
      .in("player_id", playerIds)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const s of batch) {
      const gw = s.gw as number;
      if (!statsByGw.has(gw)) statsByGw.set(gw, new Map());
      statsByGw.get(gw)!.set(s.player_id as number, {
        player_id: s.player_id as number,
        total_points: s.total_points as number | null,
        minutes: s.minutes as number | null,
      });
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return statsByGw;
}

/** Sum Mini 5 GW points across the season (all submitted GWs). */
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

  const gws = [...new Set(rows.map((r) => r.gw))].sort((a, b) => a - b);
  const allPlayerIds = new Set<number>();
  for (const row of rows) {
    for (const p of row.picks as MiniPickStored[]) allPlayerIds.add(p.fpl_id);
  }

  const statsByGw = await fetchGwStatsPaged(season, gws, [...allPlayerIds]);

  const ownershipByGw = new Map<
    number,
    { owned: Record<number, number>; entries: number }
  >();
  await Promise.all(
    gws.map(async (gw) => {
      try {
        const snap = await getMiniOwnershipSnapshot(gw, season);
        ownershipByGw.set(gw, {
          owned: snap.owned_by_id,
          entries: snap.entries,
        });
      } catch {
        ownershipByGw.set(gw, { owned: {}, entries: 0 });
      }
    }),
  );

  const groupIds = seasonGroupIds(rows);

  const byKey = new Map<
    string,
    {
      entry_id: number;
      profile_id: string | null;
      entry_name: string | null;
      total_points: number;
      gws_played: number;
      gwPoints: Map<number, number>;
    }
  >();

  rows.forEach((row, idx) => {
    const key = groupIds[idx]!;
    const picks = row.picks as MiniPickStored[];
    const pickIds = picks.map((p) => p.fpl_id);
    const fplOwnedById: Record<number, number> = {};
    for (const p of picks) {
      if (p.selected_by_percent != null) {
        fplOwnedById[p.fpl_id] = p.selected_by_percent;
      }
    }
    const own = ownershipByGw.get(row.gw);
    const scored = scoreMiniSquad(
      pickIds,
      row.captain_fpl_id,
      row.vice_fpl_id,
      statsByGw.get(row.gw) ?? new Map(),
      {
        miniOwnedById: own?.owned,
        fplOwnedById,
        miniEntries: own?.entries ?? 0,
      },
    );
    const cur = byKey.get(key) ?? {
      entry_id: row.entry_id,
      profile_id: row.profile_id ?? null,
      entry_name: row.entry_name,
      total_points: 0,
      gws_played: 0,
      gwPoints: new Map<number, number>(),
    };

    // Prefer real FPL entry id / latest nickname when merging split rows.
    if (row.entry_id > 0) cur.entry_id = row.entry_id;
    if (row.profile_id) cur.profile_id = row.profile_id;
    if (row.entry_name) cur.entry_name = row.entry_name;

    // One squad per GW: keep the better score if duplicates somehow exist.
    const prevGw = cur.gwPoints.get(row.gw);
    if (prevGw == null) {
      cur.gwPoints.set(row.gw, scored.total);
      cur.total_points += scored.total;
      cur.gws_played += 1;
    } else if (scored.total > prevGw) {
      cur.total_points += scored.total - prevGw;
      cur.gwPoints.set(row.gw, scored.total);
    }

    byKey.set(key, cur);
  });

  const ladder = [...byKey.values()]
    .map((row) => ({
      entry_id: row.entry_id,
      profile_id: row.profile_id,
      entry_name: row.entry_name,
      total_points: row.total_points,
      gws_played: row.gws_played,
      gw_scores: [...row.gwPoints.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([gw, points]) => ({ gw, points })),
    }))
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
