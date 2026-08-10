import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { chunkArray } from "@/lib/chunk";
import { fplDcPoints } from "@/lib/fpl/dc-points";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,minutes,starts,defensive_contribution,defensive_contribution_per_90,clearances_blocks_interceptions,recoveries,tackles,base_price,selected_by_percent";

export type DefconRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  team_id: number | null;
  position: string | null;
  minutes: number;
  starts: number | null;
  defensive_contribution: number;
  defensive_contribution_per_90: number | null;
  /** Season FPL points from hitting the DC threshold (sum of 0/2 per GW). */
  dc_points: number;
  cbi: number | null;
  recoveries: number | null;
  tackles: number | null;
  base_price: number | null;
  selected_by_percent: number | null;
};

export const DEFAULT_DEFCON_MIN_MINUTES = 450;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeDefconRows(
  rows: DefconRow[],
  officialIds: Set<number>,
): DefconRow[] {
  return normalizeInsightPlayerRows(rows, officialIds);
}

function toRow(row: Record<string, unknown>): DefconRow {
  return {
    fpl_id: row.fpl_id as number,
    web_name: (row.web_name as string | null) ?? (row.name as string) ?? `#${row.fpl_id}`,
    team: (row.team as string) ?? "—",
    team_id: (row.team_id as number | null) ?? null,
    position: (row.position as string | null) ?? null,
    minutes: num(row.minutes) ?? 0,
    starts: num(row.starts),
    defensive_contribution: num(row.defensive_contribution) ?? 0,
    defensive_contribution_per_90: num(row.defensive_contribution_per_90),
    dc_points: 0,
    cbi: num(row.clearances_blocks_interceptions),
    recoveries: num(row.recoveries),
    tackles: num(row.tackles),
    base_price: num(row.base_price),
    selected_by_percent: num(row.selected_by_percent),
  };
}

/** Sum per-GW DC points (2 when threshold hit) for the given players. */
async function loadSeasonDcPoints(
  rows: DefconRow[],
  season: string,
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (rows.length === 0) return out;

  const positionById = new Map(
    rows.map((r) => [r.fpl_id, r.position] as const),
  );
  const ids = rows.map((r) => r.fpl_id);
  const supa = getServerSupabase();

  for (const chunk of chunkArray(ids, 100)) {
    const { data, error } = await supa
      .from("player_gw_stats")
      .select("player_id,defensive_contribution")
      .eq("season", season)
      .in("player_id", chunk);

    if (error) throw new Error(error.message);

    for (const raw of data ?? []) {
      const r = raw as Record<string, unknown>;
      const pid = Number(r.player_id);
      if (!Number.isFinite(pid)) continue;
      const pts = fplDcPoints(
        positionById.get(pid),
        num(r.defensive_contribution) ?? 0,
      );
      out.set(pid, (out.get(pid) ?? 0) + pts);
    }
  }

  return out;
}

async function attachDcPoints(rows: DefconRow[]): Promise<DefconRow[]> {
  const season = await getCurrentFplSeason();
  const ptsById = await loadSeasonDcPoints(rows, season);
  return rows.map((row) => ({
    ...row,
    dc_points: ptsById.get(row.fpl_id) ?? 0,
  }));
}

export async function loadDefconLeadersRaw(opts?: {
  minMinutes?: number;
}): Promise<{ rows: DefconRow[] }> {
  const minMinutes = Math.max(0, opts?.minMinutes ?? DEFAULT_DEFCON_MIN_MINUTES);
  const [supa, officialIds] = await Promise.all([
    Promise.resolve(getServerSupabase()),
    loadOfficialFplPlayerIdSet(),
  ]);
  const { data, error } = await supa
    .from("players_static")
    .select(COLS)
    .gte("minutes", minMinutes)
    .gt("defensive_contribution", 0)
    .order("defensive_contribution", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const rows = normalizeDefconRows(
    (data ?? []).map((r) => toRow(r as Record<string, unknown>)),
    officialIds,
  );
  return { rows: await attachDcPoints(rows) };
}

export const loadDefconLeaders = unstable_cache(
  async () => loadDefconLeadersRaw(),
  ["fpl-insights-defcon-v3"],
  { revalidate: 300 },
);

export async function loadDefconLeadersFiltered(opts: {
  minMinutes?: number;
  position?: string | null;
  teamId?: number | null;
}): Promise<{ rows: DefconRow[] }> {
  const minMinutes = Math.max(0, opts.minMinutes ?? DEFAULT_DEFCON_MIN_MINUTES);
  const supa = getServerSupabase();
  let q = supa
    .from("players_static")
    .select(COLS)
    .gte("minutes", minMinutes)
    .gt("defensive_contribution", 0)
    .order("defensive_contribution", { ascending: false })
    .limit(150);

  if (opts.position && ["GKP", "DEF", "MID", "FWD"].includes(opts.position)) {
    q = q.eq("position", opts.position);
  }
  if (opts.teamId != null && Number.isFinite(opts.teamId)) {
    q = q.eq("team_id", opts.teamId);
  }

  const officialIds = await loadOfficialFplPlayerIdSet();
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = normalizeDefconRows(
    (data ?? []).map((r) => toRow(r as Record<string, unknown>)),
    officialIds,
  );
  return { rows: await attachDcPoints(rows) };
}
