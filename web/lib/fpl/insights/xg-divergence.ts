import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";

export const DEFAULT_XG_DIVERGENCE_MIN_MINUTES = 270;
export const DEFAULT_XG_DIVERGENCE_LIMIT = 80;

const PLAYER_COLS =
  "fpl_id,web_name,name,team,position,minutes,goals_scored,expected_goals,expected_assists,status";

export type XgDivergenceRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  minutes: number;
  goals: number;
  fpl_xg: number;
  understat_xg: number | null;
  understat_xa: number | null;
  fpl_xg_per_90: number;
  understat_xg_per_90: number | null;
  goals_per_90: number;
  fpl_vs_actual: number;
  understat_vs_actual: number | null;
  fpl_vs_understat: number | null;
};

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function per90(total: number, minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.round(((total * 90) / minutes) * 1000) / 1000;
}

async function loadUnderstatSeasonTotals(
  playerIds: number[],
  season: string,
): Promise<Map<number, { xg: number; xa: number; minutes: number }>> {
  const out = new Map<number, { xg: number; xa: number; minutes: number }>();
  if (playerIds.length === 0) return out;

  const supa = getServerSupabase();
  const understatSeason =
    process.env.FPL_UNDERSTAT_SEASON?.trim() || season;

  const { data } = await supa
    .from("understat_xg")
    .select("matched_fpl_id,xg,xa,minutes")
    .in("matched_fpl_id", playerIds)
    .eq("season", understatSeason)
    .not("matched_fpl_id", "is", null);

  for (const row of data ?? []) {
    const pid = row.matched_fpl_id as number;
    const cur = out.get(pid) ?? { xg: 0, xa: 0, minutes: 0 };
    cur.xg += num(row.xg);
    cur.xa += num(row.xa);
    cur.minutes += num(row.minutes);
    out.set(pid, cur);
  }
  return out;
}

export async function loadXgDivergenceRaw(opts?: {
  minMinutes?: number;
  limit?: number;
}): Promise<{ rows: XgDivergenceRow[]; minMinutes: number }> {
  const minMinutes =
    opts?.minMinutes ?? DEFAULT_XG_DIVERGENCE_MIN_MINUTES;
  const limit = Math.min(
    Math.max(opts?.limit ?? DEFAULT_XG_DIVERGENCE_LIMIT, 1),
    150,
  );

  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("players_static")
    .select(PLAYER_COLS)
    .gte("minutes", minMinutes)
    .in("position", ["MID", "FWD", "DEF"]);

  if (error) throw new Error(error.message);

  const pool = (data ?? []).filter((r) => {
    const s = (r.status as string | null) ?? "a";
    return s !== "u" && s !== "n";
  });

  const ids = pool.map((r) => r.fpl_id as number);
  const understat = await loadUnderstatSeasonTotals(ids, season);

  const rows: XgDivergenceRow[] = pool
    .map((r) => {
      const minutes = num(r.minutes);
      const goals = num(r.goals_scored);
      const fpl_xg = num(r.expected_goals);
      const us = understat.get(r.fpl_id as number) ?? null;
      const understat_xg = us?.xg ?? null;
      const understat_xa = us?.xa ?? null;

      const fpl_vs_actual = Math.round((fpl_xg - goals) * 100) / 100;
      const understat_vs_actual =
        understat_xg != null
          ? Math.round((understat_xg - goals) * 100) / 100
          : null;
      const fpl_vs_understat =
        understat_xg != null
          ? Math.round((fpl_xg - understat_xg) * 100) / 100
          : null;

      return {
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string) ??
          `#${r.fpl_id}`,
        team: (r.team as string) ?? "—",
        position: (r.position as string | null) ?? null,
        minutes,
        goals,
        fpl_xg: Math.round(fpl_xg * 100) / 100,
        understat_xg:
          understat_xg != null ? Math.round(understat_xg * 100) / 100 : null,
        understat_xa:
          understat_xa != null ? Math.round(understat_xa * 100) / 100 : null,
        fpl_xg_per_90: per90(fpl_xg, minutes),
        understat_xg_per_90:
          understat_xg != null && us && us.minutes > 0
            ? per90(understat_xg, us.minutes)
            : null,
        goals_per_90: per90(goals, minutes),
        fpl_vs_actual,
        understat_vs_actual,
        fpl_vs_understat,
      };
    })
    .sort((a, b) => b.fpl_vs_actual - a.fpl_vs_actual)
    .slice(0, limit);

  return { rows, minMinutes };
}

export const loadXgDivergence = unstable_cache(
  async () => loadXgDivergenceRaw(),
  ["fpl-insights-xg-divergence-v1"],
  { revalidate: 300 },
);
