import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
import { projectPlayers } from "@/lib/xp";

export const DEFAULT_XP_ACCURACY_GW_WINDOW = 5;
const BATCH = 280;

export type XpAccuracyPositionStats = {
  position: string;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
  mean_predicted: number;
  mean_actual: number;
};

export type XpAccuracyGwSummary = {
  gw: number;
  compared: number;
  mae: number;
  rmse: number;
  bias: number;
  correlation: number | null;
  mean_predicted: number;
  mean_actual: number;
  by_position: XpAccuracyPositionStats[];
};

export type XpAccuracyMiss = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  predicted: number;
  actual: number;
  error: number;
  abs_error: number;
};

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

async function backtestGw(
  targetGw: number,
  season: string,
  officialIds: Set<number>,
): Promise<XpAccuracyGwSummary | null> {
  const supa = getServerSupabase();
  const { data: actualRows, error } = await supa
    .from("player_gw_stats")
    .select("player_id,total_points,minutes")
    .eq("season", season)
    .eq("gw", targetGw)
    .gt("minutes", 0);

  if (error) throw new Error(error.message);
  if (!actualRows?.length) return null;

  const ids = actualRows
    .map((r) => r.player_id as number)
    .filter((id) => officialIds.has(id));
  const actualByPid = new Map<number, number>();
  for (const r of actualRows) {
    const pid = r.player_id as number;
    if (!officialIds.has(pid)) continue;
    actualByPid.set(pid, num(r.total_points));
  }

  const { data: staticRows } = await supa
    .from("players_static")
    .select("fpl_id,web_name,name,team,team_id,position")
    .in("fpl_id", ids);
  const metaByPid = new Map<
    number,
    {
      web_name: string;
      team: string;
      team_id: number | null;
      position: string | null;
    }
  >();
  for (const r of staticRows ?? []) {
    metaByPid.set(r.fpl_id as number, {
      web_name:
        (r.web_name as string | null) ??
        (r.name as string) ??
        `#${r.fpl_id}`,
      team: (r.team as string) ?? "—",
      team_id: (r.team_id as number | null) ?? null,
      position: (r.position as string | null) ?? null,
    });
  }

  const preds = new Map<number, number>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const proj = await projectPlayers(slice, {
      currentGw: targetGw - 1,
      fromGw: targetGw,
      toGw: targetGw,
      includeFinishedFixtures: true,
    });
    for (const id of slice) {
      const xp = proj.get(id)?.xp_total;
      if (xp != null && Number.isFinite(xp)) preds.set(id, xp);
    }
  }

  let n = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let sumBias = 0;
  let sumPred = 0;
  let sumAct = 0;
  const xs: number[] = [];
  const ys: number[] = [];
  const posBuckets = new Map<
    string,
    {
      n: number;
      sumAbs: number;
      sumSq: number;
      sumBias: number;
      sumPred: number;
      sumAct: number;
    }
  >();

  for (const [pid, act] of actualByPid) {
    const pred = preds.get(pid);
    if (pred == null || Number.isNaN(pred)) continue;
    const diff = pred - act;
    sumAbs += Math.abs(diff);
    sumSq += diff * diff;
    sumBias += diff;
    sumPred += pred;
    sumAct += act;
    n++;
    xs.push(pred);
    ys.push(act);

    const pos = metaByPid.get(pid)?.position ?? "?";
    const bucket = posBuckets.get(pos) ?? {
      n: 0,
      sumAbs: 0,
      sumSq: 0,
      sumBias: 0,
      sumPred: 0,
      sumAct: 0,
    };
    bucket.n++;
    bucket.sumAbs += Math.abs(diff);
    bucket.sumSq += diff * diff;
    bucket.sumBias += diff;
    bucket.sumPred += pred;
    bucket.sumAct += act;
    posBuckets.set(pos, bucket);
  }

  if (n === 0) return null;

  let correlation: number | null = null;
  if (n >= 3) {
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let nume = 0;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < n; i++) {
      const vx = xs[i]! - mx;
      const vy = ys[i]! - my;
      nume += vx * vy;
      dx += vx * vx;
      dy += vy * vy;
    }
    correlation =
      dx > 0 && dy > 0 ? round3(nume / Math.sqrt(dx * dy)) : null;
  }

  const by_position: XpAccuracyPositionStats[] = [...posBuckets.entries()]
    .map(([position, b]) => ({
      position,
      n: b.n,
      mae: round3(b.sumAbs / b.n),
      rmse: round3(Math.sqrt(b.sumSq / b.n)),
      bias: round3(b.sumBias / b.n),
      mean_predicted: round3(b.sumPred / b.n),
      mean_actual: round3(b.sumAct / b.n),
    }))
    .sort((a, b) => a.position.localeCompare(b.position));

  return {
    gw: targetGw,
    compared: n,
    mae: round3(sumAbs / n),
    rmse: round3(Math.sqrt(sumSq / n)),
    bias: round3(sumBias / n),
    correlation,
    mean_predicted: round3(sumPred / n),
    mean_actual: round3(sumAct / n),
    by_position,
  };
}

async function loadLatestGwMisses(
  targetGw: number,
  season: string,
  officialIds: Set<number>,
  limit = 15,
): Promise<XpAccuracyMiss[]> {
  const supa = getServerSupabase();
  const { data: actualRows } = await supa
    .from("player_gw_stats")
    .select("player_id,total_points,minutes")
    .eq("season", season)
    .eq("gw", targetGw)
    .gt("minutes", 0);

  if (!actualRows?.length) return [];

  const ids = actualRows
    .map((r) => r.player_id as number)
    .filter((id) => officialIds.has(id));
  const actualByPid = new Map<number, number>();
  for (const r of actualRows) {
    const pid = r.player_id as number;
    if (!officialIds.has(pid)) continue;
    actualByPid.set(pid, num(r.total_points));
  }

  const { data: staticRows } = await supa
    .from("players_static")
    .select("fpl_id,web_name,name,team,team_id,position")
    .in("fpl_id", ids);

  const preds = new Map<number, number>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH);
    const proj = await projectPlayers(slice, {
      currentGw: targetGw - 1,
      fromGw: targetGw,
      toGw: targetGw,
      includeFinishedFixtures: true,
    });
    for (const id of slice) {
      const xp = proj.get(id)?.xp_total;
      if (xp != null && Number.isFinite(xp)) preds.set(id, xp);
    }
  }

  const misses: (XpAccuracyMiss & { team_id: number | null })[] = [];
  for (const r of staticRows ?? []) {
    const pid = r.fpl_id as number;
    const pred = preds.get(pid);
    const actual = actualByPid.get(pid);
    if (pred == null || actual == null) continue;
    const error = round3(pred - actual);
    misses.push({
      fpl_id: pid,
      web_name:
        (r.web_name as string | null) ??
        (r.name as string) ??
        `#${pid}`,
      team: (r.team as string) ?? "—",
      team_id: (r.team_id as number | null) ?? null,
      position: (r.position as string | null) ?? null,
      predicted: round3(pred),
      actual,
      error,
      abs_error: round3(Math.abs(error)),
    });
  }

  return normalizeInsightPlayerRows(misses, officialIds)
    .map(({ team_id: _teamId, ...row }) => row)
    .sort((a, b) => b.abs_error - a.abs_error)
    .slice(0, limit);
}

export async function loadXpAccuracyRaw(
  gwWindow = DEFAULT_XP_ACCURACY_GW_WINDOW,
): Promise<{
  gws: XpAccuracyGwSummary[];
  season: string;
  aggregate: {
    mae: number;
    rmse: number;
    bias: number;
    correlation: number | null;
    gw_count: number;
  } | null;
  latest_gw: number | null;
  top_misses: XpAccuracyMiss[];
}> {
  const season = await getCurrentFplSeason();
  const officialIds = await loadOfficialFplPlayerIdSet();
  const supa = getServerSupabase();
  const { data: finishedGws } = await supa
    .from("gameweeks")
    .select("id,finished")
    .eq("finished", true)
    .order("id", { ascending: false })
    .limit(Math.max(gwWindow, 1));

  const targetGws = (finishedGws ?? [])
    .map((g) => g.id as number)
    .filter((gw) => gw >= 2)
    .slice(0, gwWindow)
    .sort((a, b) => a - b);

  const gws: XpAccuracyGwSummary[] = [];
  for (const gw of targetGws) {
    const summary = await backtestGw(gw, season, officialIds);
    if (summary) gws.push(summary);
  }

  let aggregate: {
    mae: number;
    rmse: number;
    bias: number;
    correlation: number | null;
    gw_count: number;
  } | null = null;

  if (gws.length > 0) {
    aggregate = {
      mae: round3(gws.reduce((s, g) => s + g.mae, 0) / gws.length),
      rmse: round3(gws.reduce((s, g) => s + g.rmse, 0) / gws.length),
      bias: round3(gws.reduce((s, g) => s + g.bias, 0) / gws.length),
      correlation:
        gws.filter((g) => g.correlation != null).length > 0
          ? round3(
              gws
                .filter((g) => g.correlation != null)
                .reduce((s, g) => s + (g.correlation ?? 0), 0) /
                gws.filter((g) => g.correlation != null).length,
            )
          : null,
      gw_count: gws.length,
    };
  }

  const latest_gw = gws.length > 0 ? gws[gws.length - 1]!.gw : null;
  const top_misses =
    latest_gw != null
      ? await loadLatestGwMisses(latest_gw, season, officialIds)
      : [];

  return { gws, season, aggregate, latest_gw, top_misses };
}

export const loadXpAccuracy = unstable_cache(
  async () => loadXpAccuracyRaw(),
  ["fpl-insights-xp-accuracy-v3"],
  { revalidate: 3600 },
);
