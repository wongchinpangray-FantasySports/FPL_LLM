import { fplGet } from "@/lib/fpl";
import { listCurrentPlTeams } from "@/lib/fpl/epl-2627-clubs";
import { getCurrentFplSeason } from "@/lib/fpl-season";

export type OfficialFixtureRow = {
  id: number;
  gw: number;
  home_team_id: number;
  away_team_id: number;
  home_fdr: number | null;
  away_fdr: number | null;
};

type LiveFixtureRow = {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_difficulty: number | null;
  team_a_difficulty: number | null;
};

export function officialFixtureMatchKey(
  gw: number,
  homeTeamId: number,
  awayTeamId: number,
): string {
  return `${gw}:${homeTeamId}:${awayTeamId}`;
}

export function teamFdrFromOfficialRow(
  row: OfficialFixtureRow,
  teamId: number,
): number | null {
  if (teamId === row.home_team_id) return row.home_fdr;
  if (teamId === row.away_team_id) return row.away_fdr;
  return null;
}

function rowsToMatchMap(rows: OfficialFixtureRow[]): Map<string, OfficialFixtureRow> {
  const out = new Map<string, OfficialFixtureRow>();
  for (const row of rows) {
    out.set(
      officialFixtureMatchKey(row.gw, row.home_team_id, row.away_team_id),
      row,
    );
  }
  return out;
}

async function loadOfficialRowsFromDb(
  startGw: number,
  endGw: number,
  fplSeason: string,
): Promise<OfficialFixtureRow[]> {
  const { getServerSupabase } = await import("@/lib/supabase");
  const supa = getServerSupabase();
  const { data } = await supa
    .from("fixtures")
    .select("id,gw,home_team_id,away_team_id,home_fdr,away_fdr")
    .eq("season", fplSeason)
    .gte("gw", startGw)
    .lte("gw", endGw)
    .order("gw", { ascending: true });

  return (data ?? []).map((f) => ({
    id: Number(f.id),
    gw: Number(f.gw),
    home_team_id: Number(f.home_team_id),
    away_team_id: Number(f.away_team_id),
    home_fdr: (f.home_fdr as number | null) ?? null,
    away_fdr: (f.away_fdr as number | null) ?? null,
  }));
}

async function fetchOfficialRowsFromApi(
  startGw: number,
  endGw: number,
): Promise<OfficialFixtureRow[]> {
  const live = await fplGet<LiveFixtureRow[]>("/fixtures/");
  const rows: OfficialFixtureRow[] = [];

  for (const f of live) {
    const gw = Number(f.event);
    if (!Number.isFinite(gw) || gw < startGw || gw > endGw) continue;
    rows.push({
      id: f.id,
      gw,
      home_team_id: f.team_h,
      away_team_id: f.team_a,
      home_fdr: f.team_h_difficulty ?? null,
      away_fdr: f.team_a_difficulty ?? null,
    });
  }

  return rows;
}

async function dbMissingPromotedFixtures(rows: OfficialFixtureRow[]): Promise<boolean> {
  const promotedIds = new Set(
    (await listCurrentPlTeams())
      .filter((t) => ["COV", "HUL", "IPS"].includes(t.short_name))
      .map((t) => t.id),
  );
  return [...promotedIds].some(
    (id) => !rows.some((r) => r.home_team_id === id || r.away_team_id === id),
  );
}

/** Official FPL fixture difficulty keyed by `${gw}:${homeId}:${awayId}`. */
export async function loadOfficialFixtureByMatchMap(
  startGw: number,
  endGw: number,
  fplSeason?: string,
): Promise<Map<string, OfficialFixtureRow>> {
  const season = fplSeason ?? (await getCurrentFplSeason());
  const dbRows = await loadOfficialRowsFromDb(startGw, endGw, season);

  if (dbRows.length > 0 && !(await dbMissingPromotedFixtures(dbRows))) {
    return rowsToMatchMap(dbRows);
  }

  try {
    const apiRows = await fetchOfficialRowsFromApi(startGw, endGw);
    if (apiRows.length > 0) return rowsToMatchMap(apiRows);
  } catch {
    /* use DB rows if any */
  }

  return rowsToMatchMap(dbRows);
}

/** Map PL short code (e.g. MCI) to official FPL `teams.id`. */
export async function buildShortToFplTeamIdMap(): Promise<Map<string, number>> {
  const teams = await listCurrentPlTeams();
  return new Map(teams.map((t) => [t.short_name.toUpperCase(), t.id]));
}
