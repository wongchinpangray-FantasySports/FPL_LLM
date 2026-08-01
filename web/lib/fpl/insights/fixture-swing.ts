import { unstable_cache } from "next/cache";
import { buildFplFixtureGrid } from "@/lib/fpl/fixtures-grid";
import { resolveCurrentGw } from "@/lib/xp";

export const DEFAULT_FIXTURE_SWING_HORIZON = 8;

export type FixtureSwingCell = {
  gw: number;
  opp: string;
  home: boolean;
  fdr: number;
};

export type FixtureSwingRow = {
  team_id: number;
  short: string;
  name: string;
  avg_fdr: number;
  total_fdr: number;
  fixtures: FixtureSwingCell[];
};

export async function loadFixtureSwingRaw(
  horizon = DEFAULT_FIXTURE_SWING_HORIZON,
): Promise<{
  rows: FixtureSwingRow[];
  fromGw: number;
  horizon: number;
}> {
  const h = Math.min(Math.max(Math.floor(horizon), 1), 12);
  const [{ next, current }, grid] = await Promise.all([
    resolveCurrentGw(),
    buildFplFixtureGrid(),
  ]);
  const fromGw = next >= 1 ? next : Math.max(current, 1);
  const toGw = fromGw + h - 1;

  const rows: FixtureSwingRow[] = grid.rows
    .map((team) => {
      const fixtures = team.fixtures
        .filter((fx) => fx.gw >= fromGw && fx.gw <= toGw)
        .sort((a, b) => a.gw - b.gw)
        .map((fx) => ({
          gw: fx.gw,
          opp: fx.opp,
          home: fx.home,
          fdr: fx.fdr,
        }));

      const total_fdr = fixtures.reduce((sum, fx) => sum + fx.fdr, 0);
      const avg_fdr =
        fixtures.length > 0
          ? Math.round((total_fdr / fixtures.length) * 100) / 100
          : 3;

      return {
        team_id: team.team_id,
        short: team.short,
        name: team.name,
        avg_fdr,
        total_fdr,
        fixtures,
      };
    })
    .sort((a, b) => a.avg_fdr - b.avg_fdr);

  return { rows, fromGw, horizon: h };
}

export const loadFixtureSwing = unstable_cache(
  async () => loadFixtureSwingRaw(),
  ["fpl-insights-fixture-swing-v1"],
  { revalidate: 300 },
);
