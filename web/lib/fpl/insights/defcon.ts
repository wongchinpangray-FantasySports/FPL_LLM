import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { fetchOfficialFplPlayers } from "@/lib/squad-builder/fpl-live-players";
import {
  dedupeRowsByFplId,
  dedupeRowsByPlayerIdentity,
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

function normalizeDefconRows(rows: DefconRow[]): DefconRow[] {
  return dedupeRowsByPlayerIdentity(dedupeRowsByFplId(rows));
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
    cbi: num(row.clearances_blocks_interceptions),
    recoveries: num(row.recoveries),
    tackles: num(row.tackles),
    base_price: num(row.base_price),
    selected_by_percent: num(row.selected_by_percent),
  };
}

export async function loadDefconLeadersRaw(opts?: {
  minMinutes?: number;
}): Promise<{ rows: DefconRow[] }> {
  const minMinutes = Math.max(0, opts?.minMinutes ?? DEFAULT_DEFCON_MIN_MINUTES);
  const [supa, officialPlayers] = await Promise.all([
    Promise.resolve(getServerSupabase()),
    fetchOfficialFplPlayers(),
  ]);
  const officialIds = new Set(officialPlayers.map((p) => p.fpl_id));
  const { data, error } = await supa
    .from("players_static")
    .select(COLS)
    .gte("minutes", minMinutes)
    .gt("defensive_contribution", 0)
    .order("defensive_contribution", { ascending: false })
    .limit(200);

  if (error) throw new Error(error.message);

  const rows = normalizeDefconRows(
    (data ?? [])
      .map((r) => toRow(r as Record<string, unknown>))
      .filter((r) => officialIds.has(r.fpl_id)),
  );
  return { rows };
}

export const loadDefconLeaders = unstable_cache(
  async () => loadDefconLeadersRaw(),
  ["fpl-insights-defcon-v2"],
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

  const officialIds = new Set(
    (await fetchOfficialFplPlayers()).map((p) => p.fpl_id),
  );
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return {
    rows: normalizeDefconRows(
      (data ?? [])
        .map((r) => toRow(r as Record<string, unknown>))
        .filter((r) => officialIds.has(r.fpl_id)),
    ),
  };
}
