import { fplGet } from "@/lib/fpl";

type BootstrapElement = {
  id: number;
  total_points?: number | string;
  minutes?: number | string;
  goals_scored?: number | string;
  assists?: number | string;
  clean_sheets?: number | string;
  bonus?: number | string;
  ict_index?: number | string;
  threat?: number | string;
  influence?: number | string;
  creativity?: number | string;
  expected_goals?: number | string;
  expected_assists?: number | string;
  defensive_contribution?: number | string;
  defensive_contribution_per_90?: number | string;
  points_per_game?: number | string;
};

export type PlayerLiveSeasonStats = {
  total_points: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  clean_sheets: number | null;
  bonus: number | null;
  ict_index: number | null;
  threat: number | null;
  influence: number | null;
  creativity: number | null;
  expected_goals: number | null;
  expected_assists: number | null;
  defensive_contribution: number | null;
  defensive_contribution_per_90: number | null;
  points_per_game: number | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Live season totals from FPL bootstrap-static (real-time game data). */
export async function loadPlayerLiveSeasonStats(
  fplId: number,
): Promise<PlayerLiveSeasonStats | null> {
  if (!Number.isFinite(fplId) || fplId <= 0) return null;

  const raw = await fplGet<{ elements?: BootstrapElement[] }>(
    "/bootstrap-static/",
    { cacheBust: true },
  );
  const el = (raw.elements ?? []).find((e) => e.id === fplId);
  if (!el) return null;

  return {
    total_points: num(el.total_points),
    minutes: num(el.minutes),
    goals: num(el.goals_scored),
    assists: num(el.assists),
    clean_sheets: num(el.clean_sheets),
    bonus: num(el.bonus),
    ict_index: num(el.ict_index),
    threat: num(el.threat),
    influence: num(el.influence),
    creativity: num(el.creativity),
    expected_goals: num(el.expected_goals),
    expected_assists: num(el.expected_assists),
    defensive_contribution: num(el.defensive_contribution),
    defensive_contribution_per_90: num(el.defensive_contribution_per_90),
    points_per_game: num(el.points_per_game),
  };
}
