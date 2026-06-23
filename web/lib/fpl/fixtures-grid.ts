import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { allPremierTeamIds, FPL_LAST_SEASON_GW } from "@/lib/dashboard";
import { buildFplFdrLookup, lookupFplFdr } from "@/lib/fpl/fdr";
import { loadDoubleGameweekKeys, loadTeams } from "@/lib/xp";

export type FplFdrCell = {
  fixture_id: number;
  gw: number;
  opp: string;
  opp_name: string;
  home: boolean;
  fdr: number;
};

export type FplFdrRow = {
  team_id: number;
  short: string;
  name: string;
  fixtures: FplFdrCell[];
};

export type FplFixtureGrid = {
  startGw: number;
  horizon: number;
  gwHeaders: number[];
  rows: FplFdrRow[];
  dgwKeys: string[];
  fplSeason: string;
};

async function resolveFixtureGridStartGw(): Promise<number> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("gameweeks")
    .select("id,is_current,is_next,finished")
    .order("id", { ascending: true });
  const rows = data ?? [];
  const current = rows.find((g) => g.is_current);
  const next = rows.find((g) => g.is_next);

  if (current && !current.finished) return current.id as number;
  if (next) return next.id as number;
  if (current) return (current.id as number) + 1;
  return 1;
}

export async function buildFplFixtureGrid(
  horizonInput = 6,
): Promise<FplFixtureGrid> {
  const startGw = await resolveFixtureGridStartGw();
  const horizon = Math.max(
    1,
    Math.min(horizonInput, FPL_LAST_SEASON_GW - startGw + 1),
  );
  const endGw = startGw + horizon - 1;
  const fplSeason = await getCurrentFplSeason();
  const teamIds = await allPremierTeamIds();
  const [teams, dgwKeys] = await Promise.all([
    loadTeams(),
    loadDoubleGameweekKeys(teamIds, startGw, endGw, fplSeason),
  ]);

  const supa = getServerSupabase();
  const { data: fxRows } = await supa
    .from("fixtures")
    .select("id,gw,home_team_id,away_team_id,finished")
    .eq("season", fplSeason)
    .gte("gw", startGw)
    .lte("gw", endGw)
    .order("gw", { ascending: true })
    .order("kickoff_time", { ascending: true });

  const { data: fdrPoolRows } = await supa
    .from("fixtures")
    .select("id,home_team_id,away_team_id")
    .eq("season", fplSeason)
    .gte("gw", startGw)
    .lte("gw", FPL_LAST_SEASON_GW)
    .eq("finished", false);

  const fdrLookup = buildFplFdrLookup(teams, fdrPoolRows ?? []);
  const gwHeaders = Array.from({ length: horizon }, (_, i) => startGw + i);

  const rows: FplFdrRow[] = [];
  for (const teamId of teamIds) {
    const team = teams.get(teamId);
    const cells: FplFdrCell[] = [];

    for (const fx of fxRows ?? []) {
      const isHome = fx.home_team_id === teamId;
      const isAway = fx.away_team_id === teamId;
      if (!isHome && !isAway) continue;

      const oppId = isHome ? fx.away_team_id : fx.home_team_id;
      const opp = teams.get(oppId as number);
      cells.push({
        fixture_id: fx.id as number,
        gw: fx.gw as number,
        opp: opp?.short ?? String(oppId),
        opp_name: opp?.name ?? String(oppId),
        home: isHome,
        fdr: lookupFplFdr(fdrLookup, teamId, fx.id as number),
      });
    }

    rows.push({
      team_id: teamId,
      short: team?.short ?? String(teamId),
      name: team?.name ?? String(teamId),
      fixtures: cells,
    });
  }

  return {
    startGw,
    horizon,
    gwHeaders,
    rows,
    dgwKeys: [...dgwKeys],
    fplSeason,
  };
}
