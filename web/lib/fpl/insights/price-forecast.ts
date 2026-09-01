import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";
import { getServerSupabase } from "@/lib/supabase";
import { resolveCurrentGw } from "@/lib/xp";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";

const POSITION_BY_TYPE: Record<number, string> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

/** Share of current owners typically needed for a £0.1 move (community model). */
export const PRICE_FORECAST_OWNERS_FRACTION = 0.1;
export const PRICE_FORECAST_RISE_FLOOR = 50_000;
export const PRICE_FORECAST_FALL_FLOOR = 40_000;
export const PRICE_FORECAST_LIKELY = 0.85;
export const PRICE_FORECAST_WATCH = 0.5;
export const PRICE_FORECAST_TABLE_MIN = 0.25;
const TOTAL_PLAYERS_FALLBACK = 11_000_000;

export type PriceForecastStatus =
  | "likely_rise"
  | "watch_rise"
  | "likely_fall"
  | "watch_fall"
  | "stable";

export type PriceForecastRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_short: string;
  team_id: number | null;
  position: string | null;
  current_price: number;
  selected_by_percent: number;
  transfers_in: number;
  transfers_out: number;
  net_transfers: number;
  owners_est: number;
  threshold: number;
  /** + toward a rise, − toward a fall. 1.0 ≈ typical trigger (GW cumulative). */
  progress: number;
  /** 0–1 toward the next £0.1 only (|progress| mod 1). */
  progress_next: number;
  status: PriceForecastStatus;
  cost_change_event: number;
  status_code: string;
  news: string;
  chance_of_playing: number | null;
};

export type PriceForecastData = {
  gw: number;
  total_players: number;
  source: "live" | "db";
  updated_at: string;
  rows: PriceForecastRow[];
  likely_rise: PriceForecastRow[];
  watch_rise: PriceForecastRow[];
  likely_fall: PriceForecastRow[];
  watch_fall: PriceForecastRow[];
};

type BootstrapElement = {
  id: number;
  web_name?: string;
  first_name?: string;
  second_name?: string;
  team: number;
  element_type?: number;
  now_cost?: number;
  selected_by_percent?: string | number;
  transfers_in_event?: number;
  transfers_out_event?: number;
  cost_change_event?: number;
  status?: string;
  news?: string;
  chance_of_playing_next_round?: number | null;
  minutes?: number;
};

type BootstrapPayload = {
  elements?: BootstrapElement[];
  teams?: Array<{ id: number; name: string; short_name: string }>;
  total_players?: number;
  events?: Array<{ id: number; is_current?: boolean; is_next?: boolean }>;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export function estimateOwners(
  selectedByPercent: number,
  totalPlayers: number,
): number {
  const pct = Number.isFinite(selectedByPercent) ? Math.max(0, selectedByPercent) : 0;
  const pool = totalPlayers > 0 ? totalPlayers : TOTAL_PLAYERS_FALLBACK;
  return Math.max(1, (pct / 100) * pool);
}

export function priceChangeThreshold(
  owners: number,
  direction: "rise" | "fall",
): number {
  const floor =
    direction === "rise" ? PRICE_FORECAST_RISE_FLOOR : PRICE_FORECAST_FALL_FLOOR;
  return Math.max(floor, owners * PRICE_FORECAST_OWNERS_FRACTION);
}

/**
 * Community estimate of closeness to a £0.1 move.
 * Positive = toward a rise, negative = toward a fall. |1.0| ≈ typical trigger.
 */
export function computePriceProgress(opts: {
  netTransfers: number;
  selectedByPercent: number;
  totalPlayers: number;
}): number {
  const owners = estimateOwners(opts.selectedByPercent, opts.totalPlayers);
  const direction = opts.netTransfers >= 0 ? "rise" : "fall";
  const threshold = priceChangeThreshold(owners, direction);
  if (threshold <= 0) return 0;
  return round4(opts.netTransfers / threshold);
}

export function classifyPriceProgress(progress: number): PriceForecastStatus {
  if (progress >= PRICE_FORECAST_LIKELY) return "likely_rise";
  if (progress <= -PRICE_FORECAST_LIKELY) return "likely_fall";
  if (progress >= PRICE_FORECAST_WATCH) return "watch_rise";
  if (progress <= -PRICE_FORECAST_WATCH) return "watch_fall";
  return "stable";
}

/** Fraction toward the next £0.1 move (0–1), after stripping full thresholds passed. */
export function progressTowardNextMove(progress: number): number {
  const abs = Math.abs(progress);
  if (abs <= 0) return 0;
  if (abs < 1) return round4(abs);
  return round4(abs % 1);
}

export function formatProgressPct(fraction: number): string {
  return `${Math.round(Math.abs(fraction) * 100)}%`;
}

function toForecastRow(input: {
  fpl_id: number;
  web_name: string;
  team: string;
  team_short: string;
  team_id: number | null;
  position: string | null;
  current_price: number;
  selected_by_percent: number;
  transfers_in: number;
  transfers_out: number;
  cost_change_event: number;
  status_code: string;
  news: string;
  chance_of_playing: number | null;
  total_players: number;
}): PriceForecastRow {
  const net = input.transfers_in - input.transfers_out;
  const owners = estimateOwners(input.selected_by_percent, input.total_players);
  const direction = net >= 0 ? "rise" : "fall";
  const threshold = priceChangeThreshold(owners, direction);
  const progress = computePriceProgress({
    netTransfers: net,
    selectedByPercent: input.selected_by_percent,
    totalPlayers: input.total_players,
  });
  return {
    fpl_id: input.fpl_id,
    web_name: input.web_name,
    team: input.team,
    team_short: input.team_short,
    team_id: input.team_id,
    position: input.position,
    current_price: input.current_price,
    selected_by_percent: round1(input.selected_by_percent),
    transfers_in: input.transfers_in,
    transfers_out: input.transfers_out,
    net_transfers: net,
    owners_est: Math.round(owners),
    threshold: Math.round(threshold),
    progress,
    progress_next: progressTowardNextMove(progress),
    status: classifyPriceProgress(progress),
    cost_change_event: input.cost_change_event,
    status_code: input.status_code,
    news: input.news,
    chance_of_playing: input.chance_of_playing,
  };
}

function splitBuckets(rows: PriceForecastRow[]): Pick<
  PriceForecastData,
  "likely_rise" | "watch_rise" | "likely_fall" | "watch_fall"
> {
  const byAbs = (a: PriceForecastRow, b: PriceForecastRow) =>
    Math.abs(b.progress) - Math.abs(a.progress);
  return {
    likely_rise: rows.filter((r) => r.status === "likely_rise").sort(byAbs),
    watch_rise: rows.filter((r) => r.status === "watch_rise").sort(byAbs),
    likely_fall: rows.filter((r) => r.status === "likely_fall").sort(byAbs),
    watch_fall: rows.filter((r) => r.status === "watch_fall").sort(byAbs),
  };
}

function currentGwFromBootstrap(events: BootstrapPayload["events"]): number | null {
  const cur = events?.find((e) => e.is_current) ?? events?.find((e) => e.is_next);
  return cur?.id ?? null;
}

async function loadFromLiveBootstrap(): Promise<PriceForecastData> {
  const raw = await fplGet<BootstrapPayload>("/bootstrap-static/", {
    cacheBust: true,
  });
  const totalPlayers =
    num(raw.total_players) && (raw.total_players as number) > 0
      ? Math.round(raw.total_players as number)
      : TOTAL_PLAYERS_FALLBACK;
  const teamsById = new Map(
    (raw.teams ?? []).map((t) => [
      t.id,
      { name: t.name, short: String(t.short_name ?? "").toUpperCase() },
    ]),
  );
  const gw =
    currentGwFromBootstrap(raw.events) ?? (await resolveCurrentGw()).current;

  const mapped = (raw.elements ?? [])
    .filter((el) => {
      const s = (el.status ?? "a").toLowerCase();
      return s !== "u" && s !== "n";
    })
    .map((el) => {
      const team = teamsById.get(el.team);
      const priceTenths = num(el.now_cost);
      return toForecastRow({
        fpl_id: el.id,
        web_name:
          el.web_name?.trim() ||
          `${el.first_name ?? ""} ${el.second_name ?? ""}`.trim() ||
          `#${el.id}`,
        team: team?.name ?? "—",
        team_short: team?.short ?? "",
        team_id: el.team ?? null,
        position: POSITION_BY_TYPE[el.element_type ?? 0] ?? null,
        current_price:
          priceTenths != null ? round1(priceTenths / 10) : 0,
        selected_by_percent: num(el.selected_by_percent) ?? 0,
        transfers_in: num(el.transfers_in_event) ?? 0,
        transfers_out: num(el.transfers_out_event) ?? 0,
        cost_change_event: round1((num(el.cost_change_event) ?? 0) / 10),
        status_code: (el.status ?? "a").toLowerCase(),
        news: String(el.news ?? "").trim(),
        chance_of_playing: num(el.chance_of_playing_next_round),
        total_players: totalPlayers,
      });
    });

  const officialIds = new Set(mapped.map((r) => r.fpl_id));
  const rows = normalizeInsightPlayerRows(mapped, officialIds).sort(
    (a, b) => Math.abs(b.progress) - Math.abs(a.progress),
  );
  const buckets = splitBuckets(rows);
  return {
    gw,
    total_players: totalPlayers,
    source: "live",
    updated_at: new Date().toISOString(),
    rows,
    ...buckets,
  };
}

async function loadFromDb(): Promise<PriceForecastData> {
  const { current } = await resolveCurrentGw();
  const [supa, officialIds] = await Promise.all([
    Promise.resolve(getServerSupabase()),
    loadOfficialFplPlayerIdSet(),
  ]);
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,transfers_in_event,transfers_out_event,status,news,chance_of_playing",
    );
  if (error) throw new Error(error.message);

  const teamIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.team_id as number | null)
        .filter((id): id is number => id != null),
    ),
  ];
  const { data: teamRows } = teamIds.length
    ? await supa.from("teams").select("id,short_name").in("id", teamIds)
    : { data: [] as { id: number; short_name: string }[] };
  const shortById = new Map(
    (teamRows ?? []).map((t) => [
      t.id as number,
      String(t.short_name ?? "").toUpperCase(),
    ]),
  );

  const mapped = (data ?? [])
    .filter((r) => {
      const s = String((r.status as string | null) ?? "a").toLowerCase();
      return s !== "u" && s !== "n";
    })
    .map((r) =>
      toForecastRow({
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string | null) ??
          `#${r.fpl_id}`,
        team: (r.team as string | null) ?? "—",
        team_short: shortById.get(r.team_id as number) ?? "",
        team_id: (r.team_id as number | null) ?? null,
        position: (r.position as string | null) ?? null,
        current_price: num(r.base_price) ?? 0,
        selected_by_percent: num(r.selected_by_percent) ?? 0,
        transfers_in: num(r.transfers_in_event) ?? 0,
        transfers_out: num(r.transfers_out_event) ?? 0,
        cost_change_event: 0,
        status_code: String((r.status as string | null) ?? "a").toLowerCase(),
        news: String((r.news as string | null) ?? "").trim(),
        chance_of_playing: num(r.chance_of_playing),
        total_players: TOTAL_PLAYERS_FALLBACK,
      }),
    );

  const rows = normalizeInsightPlayerRows(mapped, officialIds).sort(
    (a, b) => Math.abs(b.progress) - Math.abs(a.progress),
  );
  const buckets = splitBuckets(rows);
  return {
    gw: current,
    total_players: TOTAL_PLAYERS_FALLBACK,
    source: "db",
    updated_at: new Date().toISOString(),
    rows,
    ...buckets,
  };
}

export async function loadPriceForecastRaw(): Promise<PriceForecastData> {
  try {
    return await loadFromLiveBootstrap();
  } catch {
    return loadFromDb();
  }
}

export const loadPriceForecast = unstable_cache(
  loadPriceForecastRaw,
  ["fpl-insights-price-forecast-v1"],
  { revalidate: 120 },
);

export function tableRowsForTab(
  data: PriceForecastData,
  tab: "likely" | "rise" | "fall" | "all",
): PriceForecastRow[] {
  switch (tab) {
    case "likely":
      return [...data.likely_rise, ...data.likely_fall].sort(
        (a, b) => Math.abs(b.progress) - Math.abs(a.progress),
      );
    case "rise":
      return data.rows.filter((r) => r.progress >= PRICE_FORECAST_TABLE_MIN);
    case "fall":
      return data.rows.filter((r) => r.progress <= -PRICE_FORECAST_TABLE_MIN);
    default:
      return data.rows.filter(
        (r) => Math.abs(r.progress) >= PRICE_FORECAST_TABLE_MIN,
      );
  }
}

export type PlayerPriceForecastSnapshot = {
  gw: number;
  source: "live" | "db";
  transfers_in: number;
  transfers_out: number;
  net_transfers: number;
  progress: number;
  progress_next: number;
  status: PriceForecastStatus;
  cost_change_event: number;
  threshold: number;
};

function snapshotFromRow(
  row: PriceForecastRow,
  gw: number,
  source: "live" | "db",
): PlayerPriceForecastSnapshot {
  return {
    gw,
    source,
    transfers_in: row.transfers_in,
    transfers_out: row.transfers_out,
    net_transfers: row.net_transfers,
    progress: row.progress,
    progress_next: row.progress_next,
    status: row.status,
    cost_change_event: row.cost_change_event,
    threshold: row.threshold,
  };
}

/** Batch price-watch snapshots for squad / pitch cards (uses cached league-wide load). */
export async function loadPriceForecastMap(
  fplIds: number[],
): Promise<Map<number, PlayerPriceForecastSnapshot>> {
  const want = new Set(
    fplIds.filter((id) => Number.isFinite(id) && id > 0),
  );
  const out = new Map<number, PlayerPriceForecastSnapshot>();
  if (want.size === 0) return out;

  const data = await loadPriceForecast();
  for (const row of data.rows) {
    if (!want.has(row.fpl_id)) continue;
    out.set(row.fpl_id, snapshotFromRow(row, data.gw, data.source));
  }
  return out;
}

/** Single-player price watch snapshot for profile popups. */
export async function loadPlayerPriceForecast(
  fplId: number,
): Promise<PlayerPriceForecastSnapshot | null> {
  if (!Number.isFinite(fplId) || fplId <= 0) return null;

  try {
    const raw = await fplGet<BootstrapPayload>("/bootstrap-static/", {
      cacheBust: true,
    });
    const el = (raw.elements ?? []).find((e) => e.id === fplId);
    if (!el) return null;

    const totalPlayers =
      num(raw.total_players) && (raw.total_players as number) > 0
        ? Math.round(raw.total_players as number)
        : TOTAL_PLAYERS_FALLBACK;
    const teamsById = new Map(
      (raw.teams ?? []).map((t) => [
        t.id,
        { name: t.name, short: String(t.short_name ?? "").toUpperCase() },
      ]),
    );
    const gw =
      currentGwFromBootstrap(raw.events) ??
      (await resolveCurrentGw()).current;
    const team = teamsById.get(el.team);
    const priceTenths = num(el.now_cost);
    const row = toForecastRow({
      fpl_id: fplId,
      web_name:
        el.web_name?.trim() ||
        `${el.first_name ?? ""} ${el.second_name ?? ""}`.trim() ||
        `#${fplId}`,
      team: team?.name ?? "—",
      team_short: team?.short ?? "",
      team_id: el.team ?? null,
      position: POSITION_BY_TYPE[el.element_type ?? 0] ?? null,
      current_price: priceTenths != null ? round1(priceTenths / 10) : 0,
      selected_by_percent: num(el.selected_by_percent) ?? 0,
      transfers_in: num(el.transfers_in_event) ?? 0,
      transfers_out: num(el.transfers_out_event) ?? 0,
      cost_change_event: round1((num(el.cost_change_event) ?? 0) / 10),
      status_code: (el.status ?? "a").toLowerCase(),
      news: String(el.news ?? "").trim(),
      chance_of_playing: num(el.chance_of_playing_next_round),
      total_players: totalPlayers,
    });
    return snapshotFromRow(row, gw, "live");
  } catch {
    const { current } = await resolveCurrentGw();
    const supa = getServerSupabase();
    const { data: r, error } = await supa
      .from("players_static")
      .select(
        "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,transfers_in_event,transfers_out_event,status,news,chance_of_playing",
      )
      .eq("fpl_id", fplId)
      .maybeSingle();
    if (error || !r) return null;

    const teamId = r.team_id as number | null;
    let teamShort = "";
    if (teamId != null) {
      const { data: teamRow } = await supa
        .from("teams")
        .select("short_name")
        .eq("id", teamId)
        .maybeSingle();
      teamShort = String(teamRow?.short_name ?? "").toUpperCase();
    }

    const row = toForecastRow({
      fpl_id: fplId,
      web_name:
        (r.web_name as string | null) ??
        (r.name as string | null) ??
        `#${fplId}`,
      team: (r.team as string | null) ?? "—",
      team_short: teamShort,
      team_id: teamId,
      position: (r.position as string | null) ?? null,
      current_price: num(r.base_price) ?? 0,
      selected_by_percent: num(r.selected_by_percent) ?? 0,
      transfers_in: num(r.transfers_in_event) ?? 0,
      transfers_out: num(r.transfers_out_event) ?? 0,
      cost_change_event: 0,
      status_code: String((r.status as string | null) ?? "a").toLowerCase(),
      news: String((r.news as string | null) ?? "").trim(),
      chance_of_playing: num(r.chance_of_playing),
      total_players: TOTAL_PLAYERS_FALLBACK,
    });
    return snapshotFromRow(row, current, "db");
  }
}
