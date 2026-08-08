import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

export type UnderstatShotResult =
  | "Goal"
  | "SavedShot"
  | "BlockedShot"
  | "MissedShots"
  | "ShotOnPost"
  | string;

export type UnderstatShot = {
  id: string;
  match_id: string;
  match_date: string | null;
  minute: number | null;
  x: number;
  y: number;
  xg: number;
  result: UnderstatShotResult;
  shot_type: string | null;
  situation: string | null;
  team: string | null;
  opponent: string | null;
  h_a: "h" | "a" | null;
};

export type PlayerShotMapData = {
  fpl_id: number;
  season: string | null;
  shots: UnderstatShot[];
  totals: {
    shots: number;
    goals: number;
    xg: number;
    on_target: number;
  };
  source: "understat";
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isOnTarget(result: string | null | undefined): boolean {
  return result === "Goal" || result === "SavedShot" || result === "ShotOnPost";
}

export async function loadPlayerShotMapRaw(
  fplId: number,
  opts?: { limit?: number; season?: string },
): Promise<PlayerShotMapData | null> {
  const limit = Math.min(Math.max(opts?.limit ?? 200, 1), 400);
  const supa = getServerSupabase();

  let q = supa
    .from("understat_shots")
    .select(
      "understat_shot_id,match_id,match_date,minute,x,y,xg,result,shot_type,situation,team,opponent,h_a,season",
    )
    .eq("matched_fpl_id", fplId)
    .order("match_date", { ascending: false })
    .order("minute", { ascending: false })
    .limit(limit);

  if (opts?.season) {
    q = q.eq("season", opts.season);
  }

  const { data, error } = await q;
  if (error) {
    // Table may not exist yet before migration — treat as empty.
    if (
      error.code === "PGRST205" ||
      /understat_shots/i.test(error.message) ||
      /schema cache/i.test(error.message)
    ) {
      return {
        fpl_id: fplId,
        season: opts?.season ?? null,
        shots: [],
        totals: { shots: 0, goals: 0, xg: 0, on_target: 0 },
        source: "understat",
      };
    }
    throw new Error(error.message);
  }

  const shots: UnderstatShot[] = (data ?? [])
    .map((row) => {
      const x = num(row.x);
      const y = num(row.y);
      if (x == null || y == null) return null;
      return {
        id: String(row.understat_shot_id),
        match_id: String(row.match_id),
        match_date: (row.match_date as string | null) ?? null,
        minute: num(row.minute),
        x,
        y,
        xg: num(row.xg) ?? 0,
        result: (row.result as string) ?? "MissedShots",
        shot_type: (row.shot_type as string | null) ?? null,
        situation: (row.situation as string | null) ?? null,
        team: (row.team as string | null) ?? null,
        opponent: (row.opponent as string | null) ?? null,
        h_a:
          row.h_a === "h" || row.h_a === "a"
            ? (row.h_a as "h" | "a")
            : null,
      };
    })
    .filter((s): s is UnderstatShot => s != null);

  const goals = shots.filter((s) => s.result === "Goal").length;
  const xg = shots.reduce((a, s) => a + s.xg, 0);
  const on_target = shots.filter((s) => isOnTarget(s.result)).length;
  const season =
    opts?.season ??
    (shots[0]
      ? ((data?.[0] as { season?: string } | undefined)?.season ?? null)
      : null);

  return {
    fpl_id: fplId,
    season,
    shots,
    totals: {
      shots: shots.length,
      goals,
      xg: Math.round(xg * 1000) / 1000,
      on_target,
    },
    source: "understat",
  };
}

export async function loadPlayerShotMapCached(
  fplId: number,
  season?: string,
): Promise<PlayerShotMapData | null> {
  return unstable_cache(
    async () => loadPlayerShotMapRaw(fplId, { season, limit: 200 }),
    [`player-shot-map-v1-${fplId}-${season ?? "all"}`],
    { revalidate: 600 },
  )();
}
