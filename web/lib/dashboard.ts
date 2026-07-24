import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";
import { listCurrentPlTeams } from "@/lib/fpl/epl-2627-clubs";
import { getCurrentFplSeason } from "@/lib/fpl-season";

export interface DashFixture {
  gw: number;
  opp: string;
  home: boolean;
  fdr: number | null;
}

export interface DashTeam {
  team_id: number;
  team: string;
  short: string;
  fixtures: DashFixture[];
}

type LiveFixtureRow = {
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number | null;
  team_a_difficulty: number | null;
};

type DbFixtureRow = {
  gw: number;
  home_team_id: number;
  away_team_id: number;
  home_fdr: number | null;
  away_fdr: number | null;
  season?: string | number | null;
};

/** All current PL teams (for full-league FDR ticker). */
export async function allPremierTeamIds(): Promise<number[]> {
  const teams = await listCurrentPlTeams();
  return teams.map((t) => t.id);
}

export const FPL_LAST_SEASON_GW = 38;

async function loadFixturesForGrid(
  teamIds: number[],
  startGw: number,
  endExclusive: number,
  fplSeason: string,
): Promise<DbFixtureRow[]> {
  const { getServerSupabase } = await import("@/lib/supabase");
  const supa = getServerSupabase();
  const uniq = Array.from(new Set(teamIds));

  const { data: fx } = await supa
    .from("fixtures")
    .select(
      "season,gw,home_team_id,away_team_id,home_fdr,away_fdr",
    )
    .eq("season", fplSeason)
    .gte("gw", startGw)
    .lt("gw", endExclusive)
    .or(
      uniq
        .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
        .join(","),
    )
    .order("gw", { ascending: true });

  const rows = (fx ?? []) as DbFixtureRow[];
  const promotedIds = new Set(
    (await listCurrentPlTeams())
      .filter((t) => ["COV", "HUL", "IPS"].includes(t.short_name))
      .map((t) => t.id),
  );
  const missingPromotedFixtures = [...promotedIds].some(
    (id) => !rows.some((r) => r.home_team_id === id || r.away_team_id === id),
  );

  if (rows.length > 0 && !missingPromotedFixtures) return rows;

  try {
    const live = await fplGet<LiveFixtureRow[]>("/fixtures/");
    return live
      .filter((f) => {
        const gw = Number(f.event);
        return gw >= startGw && gw < endExclusive;
      })
      .map((f) => ({
        season: fplSeason,
        gw: Number(f.event),
        home_team_id: f.team_h,
        away_team_id: f.team_a,
        home_fdr: f.team_h_difficulty,
        away_fdr: f.team_a_difficulty,
      }));
  } catch {
    return rows;
  }
}

/**
 * Per-team fixture rundown for the given teams, over the next `horizon` GWs.
 * Dashboard ticker uses current PL clubs; heatmap uses squad teams only.
 */
export async function teamsFixtureGrid(
  teamIds: number[],
  startGw: number,
  horizon: number,
  fplSeason: string,
): Promise<DashTeam[]> {
  const plTeams = await listCurrentPlTeams();
  const teamById = new Map(
    plTeams.map((t) => [t.id, { name: t.name, short: t.short_name }]),
  );

  // Resolve opponent short codes when live fixtures use official FPL ids.
  try {
    const raw = await fplGet<{
      teams?: Array<{ id: number; short_name: string }>;
    }>("/bootstrap-static/");
    for (const t of raw.teams ?? []) {
      if (!teamById.has(t.id)) {
        teamById.set(t.id, {
          name: String(t.id),
          short: String(t.short_name ?? t.id).toUpperCase(),
        });
      }
    }
  } catch {
    /* listCurrentPlTeams already preferred bootstrap */
  }
  const ids =
    teamIds.length > 0
      ? Array.from(new Set(teamIds)).filter((id) => teamById.has(id))
      : plTeams.map((t) => t.id);

  if (ids.length === 0) return [];

  const endExclusive = Math.min(
    startGw + Math.max(horizon, 0),
    FPL_LAST_SEASON_GW + 1,
  );
  const fx = await loadFixturesForGrid(ids, startGw, endExclusive, fplSeason);

  const result: DashTeam[] = [];
  for (const id of ids) {
    const rows: DashFixture[] = [];
    for (const f of fx) {
      const isHome = f.home_team_id === id;
      const isAway = f.away_team_id === id;
      if (!isHome && !isAway) continue;
      const oppId = isHome ? f.away_team_id : f.home_team_id;
      const opp = teamById.get(oppId)?.short ?? String(oppId);
      const fdr = (isHome ? f.home_fdr : f.away_fdr) as number | null;
      rows.push({ gw: f.gw as number, opp, home: isHome, fdr });
    }
    const meta = teamById.get(id);
    result.push({
      team_id: id,
      team: meta?.name ?? String(id),
      short: meta?.short ?? String(id),
      fixtures: rows,
    });
  }

  return result.sort((a, b) => a.short.localeCompare(b.short));
}

/** Cached full-league FDR ticker (same for every dashboard visit in a GW window). */
export async function cachedAllClubsFixtureGrid(
  startGw: number,
  horizon: number,
  fplSeason: string,
): Promise<DashTeam[]> {
  return unstable_cache(
    async () => {
      const ids = await allPremierTeamIds();
      return teamsFixtureGrid(ids, startGw, horizon, fplSeason);
    },
    ["dash-all-clubs-grid-v3", fplSeason, String(startGw), String(horizon)],
    { revalidate: 600 },
  )();
}

export { fdrClass, normalizeFplFdr } from "@/lib/fpl/fdr";
