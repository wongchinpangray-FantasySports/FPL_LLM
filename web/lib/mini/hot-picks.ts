import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import type { MiniPickStored } from "@/lib/mini/types";

export interface MiniHotPick {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string | null;
  selected_count: number;
  selected_pct: number;
  captain_count: number;
}

export async function getMiniHotPicks(gw: number, limit = 10): Promise<{
  gw: number;
  season: string;
  entries: number;
  picks: MiniHotPick[];
}> {
  const supa = getServerSupabase();
  const season = await getCurrentFplSeason();
  const { data: entries, error } = await supa
    .from("mini_entries")
    .select("picks,captain_fpl_id")
    .eq("gw", gw)
    .eq("season", season);

  if (error) throw new Error(error.message);

  const rows = entries ?? [];
  const pickCounts = new Map<
    number,
    { count: number; captains: number; sample: MiniPickStored | null }
  >();

  for (const row of rows) {
    const picks = (row.picks ?? []) as MiniPickStored[];
    const seen = new Set<number>();
    for (const p of picks) {
      if (seen.has(p.fpl_id)) continue;
      seen.add(p.fpl_id);
      const cur = pickCounts.get(p.fpl_id) ?? {
        count: 0,
        captains: 0,
        sample: p,
      };
      cur.count += 1;
      cur.sample = cur.sample ?? p;
      pickCounts.set(p.fpl_id, cur);
    }
    const cap = row.captain_fpl_id as number | null;
    if (cap != null && pickCounts.has(cap)) {
      pickCounts.get(cap)!.captains += 1;
    } else if (cap != null) {
      const cur = pickCounts.get(cap) ?? {
        count: 0,
        captains: 0,
        sample: picks.find((p) => p.fpl_id === cap) ?? null,
      };
      cur.captains += 1;
      pickCounts.set(cap, cur);
    }
  }

  const n = Math.max(rows.length, 1);
  const picks: MiniHotPick[] = [...pickCounts.entries()]
    .map(([fpl_id, v]) => ({
      fpl_id,
      web_name: v.sample?.web_name ?? null,
      team: v.sample?.team ?? null,
      position: v.sample?.position ?? null,
      selected_count: v.count,
      selected_pct: Math.round((v.count / n) * 1000) / 10,
      captain_count: v.captains,
    }))
    .sort(
      (a, b) =>
        b.selected_count - a.selected_count ||
        b.captain_count - a.captain_count ||
        a.fpl_id - b.fpl_id,
    )
    .slice(0, limit);

  return { gw, season, entries: rows.length, picks };
}
