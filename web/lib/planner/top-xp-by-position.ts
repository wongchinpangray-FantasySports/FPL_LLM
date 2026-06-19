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

/** Per-line caps for home Best XI — full-league projection exceeds Worker CPU. */
const SHOWCASE_PROJ_CAP: Record<PlannerTopPosition, number> = {
  GKP: 12,
  DEF: 32,
  MID: 32,
  FWD: 26,
};

type StaticProjRow = {
  fpl_id: number;
  team_id: number | null;
  position: string | null;
  form: string | null;
  points_per_game: string | null;
  total_points: number | null;
};

function staticFormScore(r: StaticProjRow): number {
  const form = Number.parseFloat(String(r.form ?? ""));
  if (Number.isFinite(form) && form > 0) return form;
  const ppg = Number.parseFloat(String(r.points_per_game ?? ""));
  if (Number.isFinite(ppg) && ppg > 0) return ppg * 0.45;
  const tp = r.total_points != null ? Number(r.total_points) : 0;
  if (Number.isFinite(tp) && tp > 0) return tp / 38;
  return 0;
}

function pickShowcaseProjectionIds(rows: StaticProjRow[]): number[] {
  const byPos: Record<PlannerTopPosition, StaticProjRow[]> = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: [],
  };
  for (const r of rows) {
    if (r.team_id == null) continue;
    const pos = r.position as PlannerTopPosition;
    if (!byPos[pos]) continue;
    byPos[pos].push(r);
  }
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const pos of POSITIONS) {
    const sorted = [...byPos[pos]].sort(
      (a, b) => staticFormScore(b) - staticFormScore(a),
    );
    for (const r of sorted.slice(0, SHOWCASE_PROJ_CAP[pos])) {
      const id = Number(r.fpl_id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

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

/**
 * Same output shape as `computeTopXpByPosition`, but xP-projects only a
 * form-ranked subset (~100 players) so Cloudflare Workers stay under CPU limits.
 */
export async function computeTopXpByPositionForShowcase(
  horizonInput: number,
  fromGwOverride?: number,
  topPerPosition = 6,
): Promise<TopXpByPositionResult> {
  const topN = Math.min(12, Math.max(1, Math.floor(topPerPosition) || 6));
  const window = await resolvePlannerProjectionWindow(
    horizonInput,
    fromGwOverride,
  );
  const { currentGw, fromGw, toGw } = window;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id, team_id, position, form, points_per_game, total_points",
    )
    .not("team_id", "is", null)
    .in("position", [...POSITIONS]);

  if (error) {
    throw new Error(error.message);
  }

  const ids = pickShowcaseProjectionIds((data ?? []) as StaticProjRow[]);
  if (ids.length < 24) {
    throw new Error("Not enough players for showcase projection.");
  }

  const proj = await projectPlayers(ids, { currentGw, fromGw, toGw });

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
