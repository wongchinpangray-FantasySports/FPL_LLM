import { unstable_cache } from "next/cache";
import { chunkArray } from "@/lib/chunk";
import { getServerSupabase } from "@/lib/supabase";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
import {
  reliableDefconPer90,
  type ValueBandPosition,
  type ValueBandRow,
} from "@/lib/fpl/insights/value-bands";
import { projectPlayers, resolveCurrentGw, type PlayerProjection } from "@/lib/xp";

export type PlayersExplorerRow = ValueBandRow;

export type PlayersExplorerData = {
  horizon: number;
  from_gw: number;
  to_gw: number;
  assessed: number;
  rows: PlayersExplorerRow[];
  teams: string[];
  generated_at: string;
};

const PROJ_CHUNK = 80;
const DEFAULT_HORIZON = 5;

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isAvailablePlayer(status: string | null, chance: unknown): boolean {
  const s = status ?? "a";
  if (s === "u" || s === "n" || s === "s") return false;
  if (typeof chance === "number" && chance < 50) return false;
  return true;
}

/**
 * Full-pool projected table for /players (same metrics language as Best of Position).
 * Chunks projections like the planner top-xP loader.
 */
export async function loadPlayersExplorerRaw(
  horizonInput = DEFAULT_HORIZON,
): Promise<PlayersExplorerData> {
  const horizon = Math.min(Math.max(horizonInput, 1), 8);
  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();

  const { data: pool, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes,form,threat,defensive_contribution,defensive_contribution_per_90",
    )
    .in("position", ["GKP", "DEF", "MID", "FWD"])
    .not("team_id", "is", null);

  if (error) throw new Error(error.message);

  const filtered = normalizeInsightPlayerRows(
    (pool ?? [])
      .filter((r) =>
        isAvailablePlayer(
          (r.status as string | null) ?? null,
          r.chance_of_playing,
        ),
      )
      .map((r) => ({
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string) ??
          `#${r.fpl_id}`,
        team_id: (r.team_id as number | null) ?? null,
        team: (r.team as string) ?? "—",
        position: (r.position as string | null) ?? null,
        base_price: num(r.base_price),
        selected_by_percent: num(r.selected_by_percent),
        minutes: num(r.minutes) ?? 0,
        form: num(r.form),
        threat: num(r.threat),
        defensive_contribution: num(r.defensive_contribution),
        defensive_contribution_per_90: num(r.defensive_contribution_per_90),
      })),
    officialIds,
  );

  const byId = new Map(filtered.map((r) => [r.fpl_id, r]));
  const ids = filtered.map((r) => r.fpl_id);

  const { current, next } = await resolveCurrentGw();
  const fromGw = next;
  const toGw = next + horizon - 1;
  const opts = { currentGw: current, fromGw, toGw };

  const projections = new Map<number, PlayerProjection>();
  for (const chunk of chunkArray(ids, PROJ_CHUNK)) {
    const partial = await projectPlayers(chunk, opts);
    for (const [id, row] of partial) projections.set(id, row);
  }

  const rows: PlayersExplorerRow[] = Array.from(projections.values())
    .map((p) => {
      const meta = byId.get(p.fpl_id);
      const nextMins =
        p.fixtures.length > 0
          ? p.fixtures.reduce(
              (s: number, f: { expected_minutes: number }) =>
                s + f.expected_minutes,
              0,
            ) / p.fixtures.length
          : null;
      return {
        fpl_id: p.fpl_id,
        web_name: p.web_name ?? meta?.web_name ?? `#${p.fpl_id}`,
        team: p.team ?? meta?.team ?? "—",
        position: (p.position ?? meta?.position ?? null) as
          | ValueBandPosition
          | string
          | null,
        price: p.price ?? meta?.base_price ?? null,
        ownership: p.ownership ?? meta?.selected_by_percent ?? null,
        form: p.form ?? meta?.form ?? null,
        xp_total: p.xp_total,
        xp_per_game: p.xp_per_game,
        value_per_million: p.value_per_million,
        expected_minutes_next:
          nextMins != null ? Math.round(nextMins * 10) / 10 : null,
        threat: meta?.threat ?? null,
        defensive_contribution: meta?.defensive_contribution ?? null,
        defensive_contribution_per_90: reliableDefconPer90(
          meta?.minutes ?? 0,
          meta?.defensive_contribution_per_90,
        ),
        minutes: meta?.minutes ?? 0,
        preseason_goals: 0,
        preseason_assists: 0,
        preseason_starts: 0,
        fixtures: p.fixtures.map(
          (f: {
            gw: number;
            opp_short: string;
            home: boolean;
            xp_total: number;
          }) => ({
            gw: f.gw,
            opp: f.opp_short,
            home: f.home,
            xp: f.xp_total,
          }),
        ),
      };
    })
    .sort((a, b) => b.xp_total - a.xp_total);

  const teams = [...new Set(rows.map((r) => r.team).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );

  return {
    horizon,
    from_gw: fromGw,
    to_gw: toGw,
    assessed: rows.length,
    rows,
    teams,
    generated_at: new Date().toISOString(),
  };
}

export async function loadPlayersExplorerCached(
  horizon = DEFAULT_HORIZON,
): Promise<PlayersExplorerData> {
  const h = Math.min(Math.max(horizon, 1), 8);
  return unstable_cache(
    async () => loadPlayersExplorerRaw(h),
    [`players-explorer-v1-h${h}`],
    { revalidate: 300 },
  )();
}
