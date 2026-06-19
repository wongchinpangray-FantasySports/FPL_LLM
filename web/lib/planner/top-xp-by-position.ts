import { chunkArray } from "@/lib/chunk";
import { getServerSupabase } from "@/lib/supabase";
import { projectPlayers, type PlayerProjection } from "@/lib/xp";
import {
  resolvePlannerProjectionWindow,
  type PlannerProjectionWindow,
} from "@/lib/planner/projection-window";

export type TopXpPlayerRow = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string;
  /** Sum of xP across the full planner horizon (table / multi-GW). */
  xp_total: number;
  /** xP for the first GW in the window — matches pitch card `xp_next_gw`. */
  xp_next_gw: number;
};

const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
export type PlannerTopPosition = (typeof POSITIONS)[number];

export type TopXpByPositionResult = PlannerProjectionWindow & {
  tops: Record<PlannerTopPosition, TopXpPlayerRow[]>;
};

const LEAGUE_PROJ_CHUNK = 80;

function xpNextGw(p: PlayerProjection, fromGw: number): number {
  const raw = p.fixtures
    .filter((f) => f.gw === fromGw)
    .reduce((s, f) => s + f.xp_total, 0);
  return Math.round(raw * 100) / 100;
}

function toTopRow(p: PlayerProjection, fromGw: number): TopXpPlayerRow {
  return {
    fpl_id: p.fpl_id,
    web_name: p.web_name,
    team: p.team,
    position: p.position ?? "MID",
    xp_total: p.xp_total,
    xp_next_gw: xpNextGw(p, fromGw),
  };
}

/**
 * Project the full league in chunks (same engine as planner), then top 3 per
 * position by horizon xP. Pass the same `fromGw` as `/api/planner/project`.
 */
export async function computeTopXpByPosition(
  horizonInput: number,
  fromGwOverride?: number,
  topPerPosition = 3,
): Promise<TopXpByPositionResult> {
  const topN = Math.min(12, Math.max(1, Math.floor(topPerPosition) || 3));
  const window = await resolvePlannerProjectionWindow(
    horizonInput,
    fromGwOverride,
  );
  const { currentGw, fromGw, toGw, horizon } = window;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select("fpl_id")
    .not("team_id", "is", null)
    .in("position", [...POSITIONS]);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? [])
    .map((r) => r.fpl_id as number)
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0) {
    throw new Error("No players in database for projection.");
  }

  const proj = new Map<number, PlayerProjection>();
  const opts = { currentGw, fromGw, toGw };
  for (const chunk of chunkArray(ids, LEAGUE_PROJ_CHUNK)) {
    const partial = await projectPlayers(chunk, opts);
    for (const [id, row] of partial) proj.set(id, row);
  }

  const buckets: Record<string, TopXpPlayerRow[]> = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const p of proj.values()) {
    const pos = (p.position ?? "MID") as string;
    if (!buckets[pos]) continue;
    buckets[pos].push(toTopRow(p, fromGw));
  }

  const tops = {} as Record<PlannerTopPosition, TopXpPlayerRow[]>;
  for (const pos of POSITIONS) {
    tops[pos] = [...buckets[pos]]
      .sort((a, b) => b.xp_total - a.xp_total)
      .slice(0, topN);
  }

  return { ...window, tops };
}
