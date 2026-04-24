import { getServerSupabase } from "@/lib/supabase";

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

/** All FPL teams (for full-league FDR ticker). Sorted by short name. */
export async function allPremierTeamIds(): Promise<number[]> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("teams")
    .select("id")
    .order("short_name", { ascending: true });
  return (data ?? []).map((r) => r.id as number);
}

/**
 * Per-team fixture rundown for the given teams, over the next `horizon` GWs.
 * Dashboard ticker uses {@link allPremierTeamIds}; heatmap uses squad teams only.
 */
export async function teamsFixtureGrid(
  teamIds: number[],
  startGw: number,
  horizon: number,
): Promise<DashTeam[]> {
  if (teamIds.length === 0) return [];
  const supa = getServerSupabase();

  const uniq = Array.from(new Set(teamIds));
  const { data: teams } = await supa
    .from("teams")
    .select("id,name,short_name")
    .in("id", uniq);

  const { data: fx } = await supa
    .from("fixtures")
    .select(
      "gw,home_team_id,away_team_id,home_fdr,away_fdr,home_team_score,away_team_score,finished",
    )
    .gte("gw", startGw)
    .lt("gw", startGw + horizon)
    .or(
      uniq
        .flatMap((id) => [`home_team_id.eq.${id}`, `away_team_id.eq.${id}`])
        .join(","),
    )
    .order("gw", { ascending: true });

  const teamById = new Map<number, { name: string; short: string }>();
  for (const t of teams ?? []) {
    teamById.set(t.id as number, {
      name: t.name as string,
      short: t.short_name as string,
    });
  }

  const result: DashTeam[] = [];
  for (const id of uniq) {
    const rows: DashFixture[] = [];
    for (const f of fx ?? []) {
      const isHome = f.home_team_id === id;
      const isAway = f.away_team_id === id;
      if (!isHome && !isAway) continue;
      const oppId = isHome ? f.away_team_id : f.home_team_id;
      const opp = teamById.get(oppId as number)?.short ?? String(oppId);
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

  return result;
}

export function fdrClass(fdr: number | null): string {
  if (fdr === null) return "bg-white/5";
  if (fdr <= 2) return "bg-emerald-500/30 border-emerald-400/40";
  if (fdr === 3) return "bg-amber-500/25 border-amber-400/40";
  if (fdr === 4) return "bg-orange-500/30 border-orange-400/40";
  return "bg-rose-600/40 border-rose-400/50";
}
