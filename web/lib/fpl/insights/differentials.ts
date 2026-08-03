import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import { DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP } from "@/lib/fpl/insights/catalog";
import {
  loadOfficialFplPlayerIdSet,
  normalizeInsightPlayerRows,
} from "@/lib/fpl/insights/dedupe";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";

export type DifferentialFixture = {
  gw: number;
  opp: string;
  home: boolean;
  xp: number;
};

export type DifferentialRow = {
  fpl_id: number;
  web_name: string;
  team: string;
  position: string | null;
  price: number | null;
  ownership: number | null;
  form: number | null;
  xp_total: number;
  xp_per_game: number;
  value_per_million: number | null;
  fixtures: DifferentialFixture[];
};

export type DifferentialFilters = {
  position?: "GKP" | "DEF" | "MID" | "FWD";
  maxOwnership?: number;
  minPrice?: number;
  maxPrice?: number;
  horizon?: number;
  limit?: number;
};

export const DEFAULT_DIFFERENTIALS_HORIZON = 5;
export const DEFAULT_DIFFERENTIALS_LIMIT = 50;

export async function loadDifferentialsRaw(
  opts: DifferentialFilters = {},
): Promise<{ rows: DifferentialRow[]; horizon: number; maxOwnership: number }> {
  const maxOwnership = opts.maxOwnership ?? DEFAULT_DIFFERENTIALS_MAX_OWNERSHIP;
  const minPrice = opts.minPrice ?? 0;
  const maxPrice = opts.maxPrice ?? 15;
  const horizon = Math.min(Math.max(opts.horizon ?? DEFAULT_DIFFERENTIALS_HORIZON, 1), 8);
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_DIFFERENTIALS_LIMIT, 1), 80);

  const supa = getServerSupabase();
  const officialIds = await loadOfficialFplPlayerIdSet();
  let q = supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,team_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes,form",
    )
    .lte("selected_by_percent", maxOwnership)
    .gte("base_price", minPrice)
    .lte("base_price", maxPrice)
    .gte("minutes", 270);

  if (opts.position) q = q.eq("position", opts.position);

  const { data: pool, error } = await q;
  if (error) throw new Error(error.message);

  const ids = normalizeInsightPlayerRows(
    (pool ?? [])
      .filter((r) => {
        const s = (r.status as string | null) ?? "a";
        if (s === "u" || s === "n" || s === "s") return false;
        const cop = r.chance_of_playing;
        if (typeof cop === "number" && cop < 75) return false;
        return true;
      })
      .map((r) => ({
        fpl_id: r.fpl_id as number,
        web_name:
          (r.web_name as string | null) ??
          (r.name as string) ??
          `#${r.fpl_id}`,
        team_id: (r.team_id as number | null) ?? null,
      })),
    officialIds,
  ).map((r) => r.fpl_id);

  const { current, next } = await resolveCurrentGw();
  const projections = await projectPlayers(ids, {
    currentGw: current,
    fromGw: next,
    toGw: next + horizon - 1,
  });

  const rows: DifferentialRow[] = Array.from(projections.values())
    .sort((a, b) => b.xp_total - a.xp_total)
    .slice(0, limit)
    .map((p) => ({
      fpl_id: p.fpl_id,
      web_name: p.web_name ?? `#${p.fpl_id}`,
      team: p.team ?? "—",
      position: p.position,
      price: p.price,
      ownership: p.ownership,
      form: p.form,
      xp_total: p.xp_total,
      xp_per_game: p.xp_per_game,
      value_per_million: p.value_per_million,
      fixtures: p.fixtures.map((f) => ({
        gw: f.gw,
        opp: f.opp_short,
        home: f.home,
        xp: f.xp_total,
      })),
    }));

  return { rows, horizon, maxOwnership };
}

export const loadDifferentials = unstable_cache(
  async () => loadDifferentialsRaw(),
  ["fpl-insights-differentials-v2"],
  { revalidate: 300 },
);
