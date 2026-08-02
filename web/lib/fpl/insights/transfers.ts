import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { resolveCurrentGw } from "@/lib/xp";
import { dedupeRowsByFplId } from "@/lib/fpl/insights/dedupe";

const STATIC_COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,transfers_in_event,transfers_out_event,minutes,status";

export type TransferRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string | null;
  base_price: number | null;
  selected_by_percent: number | null;
  transfers_in: number;
  transfers_out: number;
  net_transfers: number;
  ownership_delta: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStaticRow(row: Record<string, unknown>): Omit<
  TransferRow,
  "ownership_delta"
> & { transfers_in: number; transfers_out: number } {
  const transfers_in = num(row.transfers_in_event) ?? 0;
  const transfers_out = num(row.transfers_out_event) ?? 0;
  return {
    fpl_id: row.fpl_id as number,
    web_name:
      (row.web_name as string | null) ?? (row.name as string) ?? `#${row.fpl_id}`,
    team: (row.team as string) ?? "—",
    team_id: (row.team_id as number | null) ?? null,
    position: (row.position as string | null) ?? null,
    base_price: num(row.base_price),
    selected_by_percent: num(row.selected_by_percent),
    transfers_in,
    transfers_out,
    net_transfers: transfers_in - transfers_out,
  };
}

async function loadOwnershipDeltas(
  playerIds: number[],
  season: string,
  currentGw: number,
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (playerIds.length === 0 || currentGw < 2) return out;

  const supa = getServerSupabase();
  const gws = [currentGw - 1, currentGw].filter((g) => g >= 1);
  const BATCH = 200;

  for (let i = 0; i < playerIds.length; i += BATCH) {
    const chunk = playerIds.slice(i, i + BATCH);
    const { data } = await supa
      .from("player_gw_stats")
      .select("player_id,gw,selected")
      .eq("season", season)
      .in("player_id", chunk)
      .in("gw", gws);

    const byPlayer = new Map<number, Map<number, number>>();
    for (const row of data ?? []) {
      const pid = row.player_id as number;
      const gw = row.gw as number;
      const sel = num(row.selected);
      if (sel == null) continue;
      if (!byPlayer.has(pid)) byPlayer.set(pid, new Map());
      byPlayer.get(pid)!.set(gw, sel);
    }

    for (const [pid, gwMap] of byPlayer) {
      const prev = gwMap.get(currentGw - 1);
      const curr = gwMap.get(currentGw);
      if (prev == null || curr == null || prev <= 0) continue;
      out.set(pid, ((curr - prev) / prev) * 100);
    }
  }

  return out;
}

export async function loadTransferMomentumRaw(): Promise<{
  rows: TransferRow[];
  gw: number;
}> {
  const season = await getCurrentFplSeason();
  const { current } = await resolveCurrentGw();
  const supa = getServerSupabase();
  const { data, error } = await supa.from("players_static").select(STATIC_COLS);

  if (error) throw new Error(error.message);

  const staticRows = (data ?? [])
    .filter((r) => {
      const s = (r.status as string | null) ?? "a";
      return s === "a" || s === "d";
    })
    .map((r) => toStaticRow(r as Record<string, unknown>));

  const ids = staticRows.map((r) => r.fpl_id);
  const deltas = await loadOwnershipDeltas(ids, season, current);

  const withActivity = staticRows.filter(
    (r) => r.transfers_in > 0 || r.transfers_out > 0,
  );
  const pool = withActivity.length > 0 ? withActivity : staticRows;

  const rows: TransferRow[] = dedupeRowsByFplId(
    pool
      .map((r) => ({
        ...r,
        ownership_delta: deltas.get(r.fpl_id) ?? null,
      }))
      .sort((a, b) => {
        const net = b.net_transfers - a.net_transfers;
        if (net !== 0) return net;
        return b.transfers_in - a.transfers_in;
      }),
  );

  return { rows, gw: current };
}

export const loadTransferMomentum = unstable_cache(
  loadTransferMomentumRaw,
  ["fpl-insights-transfers-v2"],
  { revalidate: 120 },
);
