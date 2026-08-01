import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { resolveCurrentGw } from "@/lib/xp";

export type PriceChangeEvent = {
  gw: number;
  from_price: number;
  to_price: number;
  delta: number;
};

export type PriceChangeRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  current_price: number;
  season_start_price: number | null;
  net_change: number;
  rises: number;
  falls: number;
  change_count: number;
  last_change: PriceChangeEvent | null;
  recent_changes: PriceChangeEvent[];
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function valueToPrice(valueTenths: number): number {
  return Math.round(valueTenths) / 10;
}

function buildPriceHistory(
  gwValues: { gw: number; value: number }[],
): PriceChangeEvent[] {
  const events: PriceChangeEvent[] = [];
  for (let i = 1; i < gwValues.length; i++) {
    const prev = gwValues[i - 1]!.value;
    const curr = gwValues[i]!.value;
    if (curr === prev) continue;
    events.push({
      gw: gwValues[i]!.gw,
      from_price: valueToPrice(prev),
      to_price: valueToPrice(curr),
      delta: Math.round((valueToPrice(curr) - valueToPrice(prev)) * 10) / 10,
    });
  }
  return events;
}

export async function loadPriceChangesRaw(): Promise<{
  rows: PriceChangeRow[];
  gw: number;
}> {
  const season = await getCurrentFplSeason();
  const { current } = await resolveCurrentGw();
  const supa = getServerSupabase();

  const [{ data: gwRows, error: gwError }, { data: staticRows, error: staticError }] =
    await Promise.all([
      supa
        .from("player_gw_stats")
        .select("player_id,gw,value")
        .eq("season", season)
        .not("value", "is", null)
        .order("gw"),
      supa
        .from("players_static")
        .select("fpl_id,web_name,name,team,position,base_price,status")
        .gte("minutes", 0),
    ]);

  if (gwError) throw new Error(gwError.message);
  if (staticError) throw new Error(staticError.message);

  const staticById = new Map<number, Record<string, unknown>>();
  for (const row of staticRows ?? []) {
    staticById.set(row.fpl_id as number, row as Record<string, unknown>);
  }

  const byPlayer = new Map<number, { gw: number; value: number }[]>();
  for (const row of gwRows ?? []) {
    const pid = row.player_id as number;
    const value = num(row.value);
    if (value == null) continue;
    if (!byPlayer.has(pid)) byPlayer.set(pid, []);
    byPlayer.get(pid)!.push({ gw: row.gw as number, value });
  }

  const rows: PriceChangeRow[] = [];

  for (const [pid, gwValues] of byPlayer) {
    gwValues.sort((a, b) => a.gw - b.gw);
    const events = buildPriceHistory(gwValues);
    if (events.length === 0) continue;

    const stat = staticById.get(pid);
    const s = (stat?.status as string | null) ?? "a";
    if (s === "u" || s === "n") continue;

    const rises = events.filter((e) => e.delta > 0).length;
    const falls = events.filter((e) => e.delta < 0).length;
    const net_change = events.reduce((sum, e) => sum + e.delta, 0);
    const last = events[events.length - 1] ?? null;
    const currentPrice =
      num(stat?.base_price) ??
      valueToPrice(gwValues[gwValues.length - 1]!.value);
    const seasonStart =
      gwValues.length > 0 ? valueToPrice(gwValues[0]!.value) : null;

    rows.push({
      fpl_id: pid,
      web_name:
        (stat?.web_name as string | null) ??
        (stat?.name as string) ??
        `#${pid}`,
      team: (stat?.team as string) ?? "—",
      position: (stat?.position as string | null) ?? null,
      current_price: currentPrice,
      season_start_price: seasonStart,
      net_change: Math.round(net_change * 10) / 10,
      rises,
      falls,
      change_count: events.length,
      last_change: last,
      recent_changes: events.slice(-5).reverse(),
    });
  }

  rows.sort((a, b) => {
    const aTs = a.last_change?.gw ?? 0;
    const bTs = b.last_change?.gw ?? 0;
    if (bTs !== aTs) return bTs - aTs;
    return Math.abs(b.last_change?.delta ?? 0) - Math.abs(a.last_change?.delta ?? 0);
  });

  return { rows, gw: current };
}

export const loadPriceChanges = unstable_cache(
  loadPriceChangesRaw,
  ["fpl-insights-price-changes-v1"],
  { revalidate: 300 },
);
