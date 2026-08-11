import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import type { MiniPickStored } from "@/lib/mini/types";
import { MINI_DIFF_OWN_PCT } from "@/lib/mini/incentives";
import { fetchOfficialFplPlayers } from "@/lib/squad-builder/fpl-live-players";

export interface MiniHotPick {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string | null;
  selected_count: number;
  selected_pct: number;
  captain_count: number;
  /** FPL ownership % when available (for early-GW diff fallback). */
  fpl_owned_pct?: number | null;
  form?: number | null;
}

export interface MiniOwnershipSnapshot {
  gw: number;
  season: string;
  entries: number;
  owned_by_id: Record<number, number>;
  count_by_id: Record<number, number>;
  captain_count_by_id: Record<number, number>;
  samples: Map<number, MiniPickStored>;
}

export async function getMiniOwnershipSnapshot(
  gw: number,
  season?: string,
): Promise<MiniOwnershipSnapshot> {
  const supa = getServerSupabase();
  const seasonKey = season ?? (await getCurrentFplSeason());
  const { data: entries, error } = await supa
    .from("mini_entries")
    .select("picks,captain_fpl_id")
    .eq("gw", gw)
    .eq("season", seasonKey);

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
    if (cap != null) {
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
  const owned_by_id: Record<number, number> = {};
  const count_by_id: Record<number, number> = {};
  const captain_count_by_id: Record<number, number> = {};
  const samples = new Map<number, MiniPickStored>();
  for (const [fpl_id, v] of pickCounts) {
    count_by_id[fpl_id] = v.count;
    owned_by_id[fpl_id] = Math.round((v.count / n) * 1000) / 10;
    captain_count_by_id[fpl_id] = v.captains;
    if (v.sample) samples.set(fpl_id, v.sample);
  }

  return {
    gw,
    season: seasonKey,
    entries: rows.length,
    owned_by_id,
    count_by_id,
    captain_count_by_id,
    samples,
  };
}

export async function getMiniHotPicks(gw: number, limit = 10): Promise<{
  gw: number;
  season: string;
  entries: number;
  picks: MiniHotPick[];
  differentials: MiniHotPick[];
  owned_by_id: Record<number, number>;
}> {
  const snap = await getMiniOwnershipSnapshot(gw);
  const live = await fetchOfficialFplPlayers().catch(() => []);
  const liveById = new Map(live.map((p) => [p.fpl_id, p]));

  const toRow = (fpl_id: number): MiniHotPick => {
    const sample = snap.samples.get(fpl_id);
    const liveP = liveById.get(fpl_id);
    return {
      fpl_id,
      web_name: sample?.web_name ?? liveP?.web_name ?? null,
      team: sample?.team ?? liveP?.team ?? null,
      position: sample?.position ?? liveP?.position ?? null,
      selected_count: snap.count_by_id[fpl_id] ?? 0,
      selected_pct: snap.owned_by_id[fpl_id] ?? 0,
      captain_count: snap.captain_count_by_id[fpl_id] ?? 0,
      fpl_owned_pct: liveP?.selected_by_percent ?? sample?.selected_by_percent ?? null,
      form: liveP?.form ?? sample?.form ?? null,
    };
  };

  const picks: MiniHotPick[] = Object.keys(snap.owned_by_id)
    .map((id) => toRow(Number(id)))
    .sort(
      (a, b) =>
        b.selected_count - a.selected_count ||
        b.captain_count - a.captain_count ||
        a.fpl_id - b.fpl_id,
    )
    .slice(0, limit);

  let differentials: MiniHotPick[] = [];

  if (snap.entries >= 5) {
    differentials = Object.keys(snap.owned_by_id)
      .map((id) => toRow(Number(id)))
      .filter((p) => p.selected_pct <= MINI_DIFF_OWN_PCT)
      .sort(
        (a, b) =>
          (b.form ?? 0) - (a.form ?? 0) ||
          a.selected_pct - b.selected_pct ||
          a.fpl_id - b.fpl_id,
      )
      .slice(0, limit);
  } else {
    // Early field: suggest low FPL-owned form picks as differentials.
    differentials = live
      .filter(
        (p) =>
          (p.selected_by_percent ?? 100) <= MINI_DIFF_OWN_PCT &&
          p.position !== "GKP",
      )
      .sort(
        (a, b) =>
          (b.form ?? 0) - (a.form ?? 0) ||
          (a.selected_by_percent ?? 99) - (b.selected_by_percent ?? 99),
      )
      .slice(0, limit)
      .map((p) => ({
        fpl_id: p.fpl_id,
        web_name: p.web_name,
        team: p.team,
        position: p.position,
        selected_count: 0,
        selected_pct: snap.owned_by_id[p.fpl_id] ?? 0,
        captain_count: snap.captain_count_by_id[p.fpl_id] ?? 0,
        fpl_owned_pct: p.selected_by_percent,
        form: p.form,
      }));
  }

  return {
    gw: snap.gw,
    season: snap.season,
    entries: snap.entries,
    picks,
    differentials,
    owned_by_id: snap.owned_by_id,
  };
}
