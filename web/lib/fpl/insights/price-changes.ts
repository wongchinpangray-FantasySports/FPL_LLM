import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
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
  team_id: number | null;
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

const POSITION_BY_TYPE: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

type BootstrapElement = {
  id: number;
  web_name?: string;
  first_name?: string;
  second_name?: string;
  team: number;
  element_type?: number;
  now_cost?: number;
  cost_change_event?: number;
  cost_change_start?: number;
  status?: string;
};

type BootstrapTeam = {
  id: number;
  name?: string;
  short_name?: string;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** DB `player_gw_stats.value` is already £m (sync divides tenths). */
function pounds(v: number): number {
  return Math.round(v * 10) / 10;
}

function tenthsToPounds(tenths: number): number {
  return Math.round(tenths) / 10;
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
      from_price: pounds(prev),
      to_price: pounds(curr),
      delta: pounds(curr - prev),
    });
  }
  return events;
}

async function loadFromLiveBootstrap(
  currentGw: number,
): Promise<PriceChangeRow[] | null> {
  try {
    const raw = await fplGet<{
      elements?: BootstrapElement[];
      teams?: BootstrapTeam[];
    }>("/bootstrap-static/");
    const elements = raw.elements ?? [];
    if (!elements.length) return null;

    const teamsById = new Map((raw.teams ?? []).map((t) => [t.id, t] as const));
    const rows: PriceChangeRow[] = [];

    for (const el of elements) {
      const status = (el.status ?? "a").toLowerCase();
      if (status === "u" || status === "n") continue;

      const eventTenths = num(el.cost_change_event) ?? 0;
      const startTenths = num(el.cost_change_start) ?? 0;
      if (eventTenths === 0 && startTenths === 0) continue;

      const current =
        num(el.now_cost) != null ? tenthsToPounds(num(el.now_cost)!) : 0;
      const net = tenthsToPounds(startTenths);
      const eventDelta = tenthsToPounds(eventTenths);
      const seasonStart = pounds(current - net);
      const team = teamsById.get(el.team);
      const last_change =
        eventTenths !== 0
          ? {
              gw: currentGw,
              from_price: pounds(current - eventDelta),
              to_price: current,
              delta: eventDelta,
            }
          : null;

      rows.push({
        fpl_id: el.id,
        web_name:
          el.web_name?.trim() ||
          `${el.first_name ?? ""} ${el.second_name ?? ""}`.trim() ||
          `#${el.id}`,
        team: (team?.short_name ?? team?.name ?? "—").trim() || "—",
        team_id: el.team ?? null,
        position: POSITION_BY_TYPE[el.element_type ?? 0] ?? null,
        current_price: current,
        season_start_price: seasonStart,
        net_change: net,
        rises: net > 0 ? Math.max(1, Math.round(Math.abs(net) * 10)) : 0,
        falls: net < 0 ? Math.max(1, Math.round(Math.abs(net) * 10)) : 0,
        change_count: Math.max(
          1,
          Math.round(Math.abs(net) * 10) || (eventTenths !== 0 ? 1 : 0),
        ),
        last_change,
        recent_changes: last_change ? [last_change] : [],
      });
    }

    return rows;
  } catch {
    return null;
  }
}

async function loadFromGwHistory(currentGw: number): Promise<PriceChangeRow[]> {
  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();

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
        .select("fpl_id,web_name,name,team,team_id,position,base_price,status")
        .gte("minutes", 0),
    ]);

  if (gwError) throw new Error(gwError.message);
  if (staticError) throw new Error(staticError.message);

  const staticList = staticRows ?? [];
  const normalizedStatic = normalizeInsightPlayerRows(
    staticList.map((r) => ({
      fpl_id: r.fpl_id as number,
      web_name: (r.web_name as string | null) ?? (r.name as string),
      team_id: (r.team_id as number | null) ?? null,
    })),
    officialIds,
  );
  const staticById = new Map<number, Record<string, unknown>>();
  for (const stub of normalizedStatic) {
    const full = staticList.find((r) => r.fpl_id === stub.fpl_id);
    if (full) staticById.set(stub.fpl_id, full as Record<string, unknown>);
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
    if (!officialIds.has(pid)) continue;
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
      num(stat?.base_price) ?? pounds(gwValues[gwValues.length - 1]!.value);
    const seasonStart =
      gwValues.length > 0 ? pounds(gwValues[0]!.value) : null;

    rows.push({
      fpl_id: pid,
      web_name:
        (stat?.web_name as string | null) ??
        (stat?.name as string) ??
        `#${pid}`,
      team: (stat?.team as string) ?? "—",
      team_id: (stat?.team_id as number | null) ?? null,
      position: (stat?.position as string | null) ?? null,
      current_price: currentPrice,
      season_start_price: seasonStart,
      net_change: pounds(net_change),
      rises,
      falls,
      change_count: events.length,
      last_change: last,
      recent_changes: events.slice(-5).reverse(),
    });
  }

  void currentGw;
  return normalizeInsightPlayerRows(rows, officialIds);
}

function mergeRows(
  history: PriceChangeRow[],
  live: PriceChangeRow[] | null,
): PriceChangeRow[] {
  if (!live?.length) return history;
  if (!history.length) return live;

  const byId = new Map(history.map((r) => [r.fpl_id, r] as const));
  for (const liveRow of live) {
    const existing = byId.get(liveRow.fpl_id);
    if (!existing) {
      byId.set(liveRow.fpl_id, liveRow);
      continue;
    }
    // Prefer live current price / this-GW move; keep richer history counts when present.
    byId.set(liveRow.fpl_id, {
      ...existing,
      current_price: liveRow.current_price || existing.current_price,
      team: liveRow.team || existing.team,
      team_id: liveRow.team_id ?? existing.team_id,
      position: liveRow.position ?? existing.position,
      net_change:
        Math.abs(liveRow.net_change) >= Math.abs(existing.net_change)
          ? liveRow.net_change
          : existing.net_change,
      last_change: liveRow.last_change ?? existing.last_change,
      recent_changes:
        liveRow.last_change &&
        (!existing.recent_changes.some(
          (e) =>
            e.gw === liveRow.last_change!.gw &&
            e.delta === liveRow.last_change!.delta,
        ))
          ? [liveRow.last_change, ...existing.recent_changes].slice(0, 5)
          : existing.recent_changes,
      change_count: Math.max(existing.change_count, liveRow.change_count),
      rises: Math.max(existing.rises, liveRow.rises),
      falls: Math.max(existing.falls, liveRow.falls),
    });
  }
  return [...byId.values()];
}

export async function loadPriceChangesRaw(): Promise<{
  rows: PriceChangeRow[];
  gw: number;
}> {
  const { current } = await resolveCurrentGw();
  const [live, history] = await Promise.all([
    loadFromLiveBootstrap(current),
    loadFromGwHistory(current).catch(() => [] as PriceChangeRow[]),
  ]);

  const rows = mergeRows(history, live).sort((a, b) => {
    const aTs = a.last_change?.gw ?? 0;
    const bTs = b.last_change?.gw ?? 0;
    if (bTs !== aTs) return bTs - aTs;
    return (
      Math.abs(b.last_change?.delta ?? 0) - Math.abs(a.last_change?.delta ?? 0)
    );
  });

  return { rows, gw: current };
}

export const loadPriceChanges = unstable_cache(
  loadPriceChangesRaw,
  ["fpl-insights-price-changes-v3"],
  { revalidate: 300 },
);
