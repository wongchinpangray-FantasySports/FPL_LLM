/**
 * Enrich recommended-squad list stats (same metrics as /players explorer).
 * Invoked by render-xhs-squad.mjs
 *
 *   npx tsx scripts/load-xhs-squad-stats.ts
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { getServerSupabase } from "../lib/supabase";
import { projectPlayers, resolveCurrentGw } from "../lib/xp";
import {
  reliableDefconPer90,
  VALUE_BAND_MIN_DEFCON_MINUTES,
} from "../lib/fpl/insights/value-bands";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

const IDS = [
  // 2026-08-15 No Fernandes Squad (Haaland C · Osula V)
  109, 229, 532, 423, 154, 155, 335, 400, 411, 465, 165, 529, 60, 84, 290,
];

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function reliablePer90(
  minutes: number,
  seasonTotal: number | null | undefined,
  minMinutes = VALUE_BAND_MIN_DEFCON_MINUTES,
): number | null {
  if (minutes < minMinutes) return null;
  if (seasonTotal == null || !Number.isFinite(seasonTotal) || seasonTotal < 0) {
    return null;
  }
  return Math.round((seasonTotal / minutes) * 90 * 100) / 100;
}

async function main() {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,team,position,base_price,selected_by_percent,minutes,threat,goals_scored,assists,expected_goals,expected_assists,defensive_contribution,defensive_contribution_per_90",
    )
    .in("fpl_id", IDS);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((r) => [r.fpl_id as number, r]));
  const { current } = await resolveCurrentGw();
  const fromGw = 1;
  const toGw = 6;
  const projections = await projectPlayers(IDS, {
    currentGw: current,
    fromGw,
    toGw,
    includeFinishedFixtures: true,
  });

  const out: Record<
    number,
    {
      xp_total: number | null;
      expected_minutes_next: number | null;
      value_per_million: number | null;
      goals: number | null;
      assists: number | null;
      threat: number | null;
      xg_per_90: number | null;
      xa_per_90: number | null;
      dc_per_90: number | null;
      ownership: number | null;
      price: number | null;
      team: string | null;
      position: string | null;
      web_name: string | null;
      gw_run: {
        gw: number;
        opp: string;
        home: boolean;
        fdr: number | null;
        xp: number;
      }[];
    }
  > = {};

  for (const id of IDS) {
    const meta = byId.get(id);
    const p = projections.get(id);
    const mins = num(meta?.minutes) ?? 0;
    const nextMins =
      p && p.fixtures.length > 0
        ? p.fixtures.reduce((s, f) => s + f.expected_minutes, 0) /
          p.fixtures.length
        : null;
    out[id] = {
      xp_total: p?.xp_total ?? null,
      expected_minutes_next:
        nextMins != null ? Math.round(nextMins * 10) / 10 : null,
      value_per_million: p?.value_per_million ?? null,
      goals: num(meta?.goals_scored),
      assists: num(meta?.assists),
      threat: num(meta?.threat),
      xg_per_90: reliablePer90(mins, num(meta?.expected_goals)),
      xa_per_90: reliablePer90(mins, num(meta?.expected_assists)),
      dc_per_90: reliableDefconPer90(
        mins,
        num(meta?.defensive_contribution_per_90),
      ),
      ownership: num(meta?.selected_by_percent),
      price: num(meta?.base_price),
      team: (meta?.team as string | null) ?? null,
      position: (meta?.position as string | null) ?? null,
      web_name: (meta?.web_name as string | null) ?? null,
      gw_run: (p?.fixtures ?? [])
        .filter((f) => f.gw >= fromGw && f.gw <= toGw)
        .map((f) => ({
          gw: f.gw,
          opp: f.opp_short,
          home: f.home,
          fdr: f.fdr,
          xp: f.xp_total,
        })),
    };
  }

  const path = join(process.cwd(), "output", "xhs", "squad-explorer-stats.json");
  writeFileSync(
    path,
    JSON.stringify({ from_gw: fromGw, to_gw: toGw, horizon: 6, by_id: out }, null, 2),
    "utf8",
  );
  console.log(`Wrote ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
