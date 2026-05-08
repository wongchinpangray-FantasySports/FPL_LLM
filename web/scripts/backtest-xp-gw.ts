/**
 * Backtest xP vs actual FPL points for one GW (historical replay).
 * Rolling stats end at GW (target-1); projection window is only GW target,
 * with finished fixtures included so past gameweeks replay correctly.
 *
 * Run from `web/`: npx tsx scripts/backtest-xp-gw.ts 35
 * Requires Supabase env (see lib/supabase.ts) and synced player_gw_stats / fixtures.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvLocal();

async function main(): Promise<void> {
  const targetGw = Number(process.argv[2] ?? "35");
  if (!Number.isFinite(targetGw) || targetGw < 2) {
    console.error("Usage: npx tsx scripts/backtest-xp-gw.ts <gameweek>");
    process.exit(1);
  }

  const { getServerSupabase } = await import("../lib/supabase");
  const { projectPlayers } = await import("../lib/xp");

  const supa = getServerSupabase();
  const { data: actualRows, error } = await supa
    .from("player_gw_stats")
    .select("player_id,total_points,minutes")
    .eq("gw", targetGw)
    .gt("minutes", 0);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = actualRows ?? [];
  if (rows.length === 0) {
    console.log(
      `No player_gw_stats for GW${targetGw} with minutes>0. Sync FPL history/live first.`,
    );
    process.exit(0);
  }

  const ids = rows.map((r) => r.player_id as number);
  const actualByPid = new Map<number, number>();
  for (const r of rows) {
    actualByPid.set(r.player_id as number, Number(r.total_points));
  }

  const { data: staticRows } = await supa
    .from("players_static")
    .select("fpl_id,position")
    .in("fpl_id", ids);
  const positionByPid = new Map<number, string>();
  for (const r of staticRows ?? []) {
    positionByPid.set(r.fpl_id as number, String(r.position ?? "?"));
  }

  const BATCH = 280;
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
      preds.set(id, proj.get(id)?.xp_total ?? NaN);
    }
  }

  let n = 0;
  let sumAbs = 0;
  let sumSq = 0;
  let sumBias = 0;
  let skippedNoProj = 0;

  const xs: number[] = [];
  const ys: number[] = [];

  let sumPred = 0;
  let sumAct = 0;

  type PosAgg = {
    n: number;
    sumAbs: number;
    sumSq: number;
    sumBias: number;
    sumPred: number;
    sumAct: number;
  };
  const posBuckets = new Map<string, PosAgg>();

  function bumpPos(pos: string, pred: number, act: number): void {
    const diff = pred - act;
    let b = posBuckets.get(pos);
    if (!b) {
      b = { n: 0, sumAbs: 0, sumSq: 0, sumBias: 0, sumPred: 0, sumAct: 0 };
      posBuckets.set(pos, b);
    }
    b.n++;
    b.sumAbs += Math.abs(diff);
    b.sumSq += diff * diff;
    b.sumBias += diff;
    b.sumPred += pred;
    b.sumAct += act;
  }

  for (const [pid, act] of actualByPid) {
    const x = preds.get(pid);
    if (x == null || Number.isNaN(x)) {
      skippedNoProj++;
      continue;
    }
    const diff = x - act;
    sumAbs += Math.abs(diff);
    sumSq += diff * diff;
    sumBias += diff;
    sumPred += x;
    sumAct += act;
    bumpPos(positionByPid.get(pid) ?? "?", x, act);
    n++;
    xs.push(x);
    ys.push(act);
  }

  const mae = n ? sumAbs / n : 0;
  const rmse = n ? Math.sqrt(sumSq / n) : 0;
  const bias = n ? sumBias / n : 0;

  const byPosition: Record<
    string,
    {
      n: number;
      mae: number;
      rmse: number;
      meanPredictedMinusActual: number;
      meanPredicted: number | null;
      meanActual: number | null;
    }
  > = {};

  for (const [pos, b] of posBuckets) {
    if (b.n === 0) continue;
    byPosition[pos] = {
      n: b.n,
      mae: Number((b.sumAbs / b.n).toFixed(3)),
      rmse: Number(Math.sqrt(b.sumSq / b.n).toFixed(3)),
      meanPredictedMinusActual: Number((b.sumBias / b.n).toFixed(3)),
      meanPredicted: Number((b.sumPred / b.n).toFixed(3)),
      meanActual: Number((b.sumAct / b.n).toFixed(3)),
    };
  }

  let corr = NaN;
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
    corr = dx > 0 && dy > 0 ? nume / Math.sqrt(dx * dy) : NaN;
  }

  console.log(
    JSON.stringify(
      {
        targetGw,
        rollingThroughGw: targetGw - 1,
        playersActualMinutesGt0: rows.length,
        compared: n,
        skippedNoProjection: skippedNoProj,
        mae: Number(mae.toFixed(3)),
        rmse: Number(rmse.toFixed(3)),
        meanPredictedMinusActual: Number(bias.toFixed(3)),
        meanPredicted:
          n > 0 ? Number((sumPred / n).toFixed(3)) : null,
        meanActual:
          n > 0 ? Number((sumAct / n).toFixed(3)) : null,
        byPosition,
        correlationXpVsActual: Number.isFinite(corr)
          ? Number(corr.toFixed(4))
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
