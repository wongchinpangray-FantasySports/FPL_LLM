import { getServerSupabase } from "@/lib/supabase";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";

export type TopXpPlayerRow = {
  fpl_id: number;
  web_name: string | null;
  team: string | null;
  position: string;
  xp_total: number;
};

const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
export type PlannerTopPosition = (typeof POSITIONS)[number];

export type TopXpByPositionResult = {
  currentGw: number;
  fromGw: number;
  toGw: number;
  horizon: number;
  tops: Record<PlannerTopPosition, TopXpPlayerRow[]>;
};

/**
 * Full-league projection for the horizon window, then top 3 by total xP per
 * FPL position (same engine as the planner).
 */
export async function computeTopXpByPosition(
  horizon: number,
): Promise<TopXpByPositionResult> {
  const { current } = await resolveCurrentGw();
  const h = Math.min(8, Math.max(1, Math.floor(horizon) || 5));
  const fromGw = current + 1;
  const toGw = fromGw + h - 1;

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

  const proj = await projectPlayers(ids, {
    currentGw: current,
    fromGw,
    toGw,
  });

  const buckets: Record<string, TopXpPlayerRow[]> = {
    GKP: [],
    DEF: [],
    MID: [],
    FWD: [],
  };

  for (const p of proj.values()) {
    const pos = (p.position ?? "MID") as string;
    if (!buckets[pos]) continue;
    buckets[pos].push({
      fpl_id: p.fpl_id,
      web_name: p.web_name,
      team: p.team,
      position: pos,
      xp_total: p.xp_total,
    });
  }

  const tops = {} as Record<PlannerTopPosition, TopXpPlayerRow[]>;
  for (const pos of POSITIONS) {
    tops[pos] = [...buckets[pos]]
      .sort((a, b) => b.xp_total - a.xp_total)
      .slice(0, 3);
  }

  return {
    currentGw: current,
    fromGw,
    toGw,
    horizon: h,
    tops,
  };
}
