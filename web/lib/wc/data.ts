import { getServerSupabase } from "@/lib/supabase";
import { ensureWcSeeded } from "@/lib/wc/seed";
import { ensureWcPlayerPool, type WcPoolStatus } from "@/lib/wc/player-pool";
import { buildWcFdrLookup, lookupWcFdr } from "@/lib/wc/fdr";
import { projectWcPlayers } from "@/lib/wc/xp";
import type { WcPlayer, WcTeam } from "@/lib/wc/types";
import { wcTeamFullName } from "@/lib/wc/team-names";

export type WcFdrCell = {
  matchday: number;
  opp_code: string;
  opp_name: string;
  home: boolean;
  fdr: number;
};

export type WcFdrRow = {
  team_id: number;
  code: string;
  name: string;
  short_name: string;
  group_letter: string;
  fixtures: WcFdrCell[];
};

export type WcXpRow = {
  id: number;
  name: string;
  team_code: string;
  team_name: string;
  position: string;
  xp_total: number;
  byMd: Record<
    number,
    { xp: number; opp: string; opp_name: string; home: boolean; fdr: number }
  >;
};

export type WcPlayerListItem = {
  id: number;
  name: string;
  team_code: string;
  team_name: string;
  position: string;
};

async function loadTeams(): Promise<Map<number, WcTeam>> {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_teams")
    .select(
      "id,code,name,short_name,group_letter,attack_strength,defence_strength",
    )
    .order("group_letter")
    .order("short_name");

  if (error) throw new Error(error.message);

  const map = new Map<number, WcTeam>();
  for (const r of data ?? []) {
    map.set(r.id as number, r as WcTeam);
  }
  return map;
}

async function loadFixtures() {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_fixtures")
    .select("id,matchday,home_team_id,away_team_id")
    .order("matchday");

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadPlayers(): Promise<WcPlayer[]> {
  await ensureWcPlayerPool();
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_players")
    .select(
      "id,wc_team_id,name,fpl_id,position,price,goals,assists,xg,xa,form,minutes,wc_teams(code,short_name)",
    )
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => {
    const teamRaw = r.wc_teams as
      | { code: string; short_name: string }
      | { code: string; short_name: string }[]
      | null;
    const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
    return {
      id: r.id as number,
      wc_team_id: r.wc_team_id as number,
      name: r.name as string,
      fpl_id: r.fpl_id as number | null,
      position: r.position as string,
      team_code: team?.code ?? "???",
      team_short: team?.short_name ?? "???",
      price: r.price as number | null,
      goals: Number(r.goals ?? 0),
      assists: Number(r.assists ?? 0),
      xg: Number(r.xg ?? 0),
      xa: Number(r.xa ?? 0),
      form: Number(r.form ?? 0),
      minutes: Number(r.minutes ?? 0),
    };
  });
}

export async function buildWcFdrGrid(): Promise<WcFdrRow[]> {
  await ensureWcSeeded();
  const teams = await loadTeams();
  const fixtures = await loadFixtures();
  const fdrLookup = buildWcFdrLookup(teams, fixtures);

  const rows: WcFdrRow[] = [];

  for (const [teamId, team] of teams) {
    const cells: WcFdrCell[] = [];
    for (const fx of fixtures) {
      if (fx.home_team_id !== teamId && fx.away_team_id !== teamId) continue;
      const home = fx.home_team_id === teamId;
      const oppId = home ? fx.away_team_id : fx.home_team_id;
      const opp = teams.get(oppId as number);
      if (!opp) continue;
      cells.push({
        matchday: fx.matchday as number,
        opp_code: opp.code,
        opp_name: opp.name,
        home,
        fdr: lookupWcFdr(fdrLookup, teamId, fx.matchday as number),
      });
    }
    rows.push({
      team_id: teamId,
      code: team.code,
      name: team.name,
      short_name: team.short_name,
      group_letter: team.group_letter,
      fixtures: cells.sort((a, b) => a.matchday - b.matchday),
    });
  }

  return rows.sort((a, b) =>
    a.group_letter === b.group_letter
      ? a.short_name.localeCompare(b.short_name)
      : a.group_letter.localeCompare(b.group_letter),
  );
}

export async function buildWcXpRows(position?: string): Promise<{
  matchdays: number[];
  rows: WcXpRow[];
}> {
  await ensureWcSeeded();
  const teams = await loadTeams();
  const fixtures = await loadFixtures();
  const fdrLookup = buildWcFdrLookup(teams, fixtures);
  let players = await loadPlayers();
  if (position && position !== "ALL") {
    players = players.filter((p) => p.position === position);
  }

  const projections = projectWcPlayers(players, teams, fixtures, fdrLookup);
  const matchdays = [...new Set(fixtures.map((f) => f.matchday as number))].sort(
    (a, b) => a - b,
  );

  const rows: WcXpRow[] = projections.map((p) => {
    const byMd: WcXpRow["byMd"] = {};
    for (const f of p.fixtures) {
      byMd[f.matchday] = {
        xp: f.xp,
        opp: f.opp_code,
        opp_name: wcTeamFullName(f.opp_code),
        home: f.home,
        fdr: f.fdr,
      };
    }
    return {
      id: p.player.id,
      name: p.player.name,
      team_code: p.player.team_code,
      team_name: wcTeamFullName(p.player.team_code),
      position: p.player.position,
      xp_total: p.xp_total,
      byMd,
    };
  });

  return { matchdays, rows };
}

export async function listWcPlayers(): Promise<WcPlayerListItem[]> {
  await ensureWcSeeded();
  const players = await loadPlayers();
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    team_code: p.team_code,
    team_name: wcTeamFullName(p.team_code),
    position: p.position,
  }));
}

export async function getWcPlayerById(id: number): Promise<WcPlayer | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  await ensureWcSeeded();
  await ensureWcPlayerPool();
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_players")
    .select(
      "id,wc_team_id,name,fpl_id,position,price,goals,assists,xg,xa,form,minutes,wc_teams(code,short_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const teamRaw = data.wc_teams as
    | { code: string; short_name: string }
    | { code: string; short_name: string }[]
    | null;
  const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;

  return {
    id: data.id as number,
    wc_team_id: data.wc_team_id as number,
    name: data.name as string,
    fpl_id: data.fpl_id as number | null,
    position: data.position as string,
    team_code: team?.code ?? "???",
    team_short: team?.short_name ?? "???",
    price: data.price as number | null,
    goals: Number(data.goals ?? 0),
    assists: Number(data.assists ?? 0),
    xg: Number(data.xg ?? 0),
    xa: Number(data.xa ?? 0),
    form: Number(data.form ?? 0),
    minutes: Number(data.minutes ?? 0),
  };
}

export async function getWcPlayersByIds(ids: number[]): Promise<WcPlayer[]> {
  await ensureWcSeeded();
  const players = await loadPlayers();
  const set = new Set(ids);
  return players.filter((p) => set.has(p.id));
}

export async function loadAllWcPlayers(): Promise<WcPlayer[]> {
  await ensureWcSeeded();
  return loadPlayers();
}

export async function getWcPoolStatus(): Promise<WcPoolStatus> {
  await ensureWcSeeded();
  return ensureWcPlayerPool();
}
