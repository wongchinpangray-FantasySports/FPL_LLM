import { getServerSupabase } from "@/lib/supabase";
import { ensureWcSeeded } from "@/lib/wc/seed";
import { ensureWcPlayerPool, type WcPoolStatus } from "@/lib/wc/player-pool";
import { buildWcFdrLookup, lookupWcFdr } from "@/lib/wc/fdr";
import { enrichWcPlayersFromFpl } from "@/lib/wc/fpl-enrich";
import { hydrateWcPlayer, hydrateWcPlayers } from "@/lib/wc/player-priors";
import { projectWcPlayers } from "@/lib/wc/xp";
import {
  buildFplNameIndexes,
  buildFplPlayerIndex,
  type FplPlayerIndex,
} from "@/lib/wc/fpl-club-resolve";
import {
  buildWcScoutingReport,
  type ScoutingXpSnap,
  type WcScoutingReport,
} from "@/lib/wc/scouting";
import type { WcPlayer, WcTeam } from "@/lib/wc/types";
import { wcTeamFullName } from "@/lib/wc/team-names";

export type { WcScoutingReport, WcScoutPick, WcScoutArchetype } from "@/lib/wc/scouting";

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
  price: number | null;
  selection_pct: number;
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

function mapWcPlayerRow(r: Record<string, unknown>): WcPlayer {
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
    price: r.price != null ? Number(r.price) : null,
    selection_pct: Number(r.selection_pct ?? 0),
    goals: Number(r.goals ?? 0),
    assists: Number(r.assists ?? 0),
    xg: Number(r.xg ?? 0),
    xa: Number(r.xa ?? 0),
    form: Number(r.form ?? 0),
    minutes: Number(r.minutes ?? 0),
    season_club: (r.season_club as string | null) ?? null,
    season_league: (r.season_league as string | null) ?? null,
    club_source: (r.club_source as string | null) ?? null,
  };
}

type LoadPlayersOptions = {
  /** Read path only — no pool refresh, FPL linking, or other writes (Cloudflare subrequest budget). */
  readOnly?: boolean;
};

async function fetchAllWcPlayerRows(
  supa: ReturnType<typeof getServerSupabase>,
): Promise<Record<string, unknown>[]> {
  const select =
    "id,wc_team_id,name,fpl_id,position,price,selection_pct,goals,assists,xg,xa,form,minutes,season_club,season_league,club_source,wc_teams(code,short_name)";
  const PAGE = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supa
      .from("wc_players")
      .select(select)
      .order("name")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...(batch as Record<string, unknown>[]));
    if (batch.length < PAGE) break;
  }
  return rows;
}

async function loadPlayers(opts?: LoadPlayersOptions): Promise<WcPlayer[]> {
  if (!opts?.readOnly) {
    await ensureWcPlayerPool();
  }
  const supa = getServerSupabase();

  if (!opts?.readOnly) {
    const { count: fifaCount } = await supa
      .from("wc_players")
      .select("id", { count: "exact", head: true })
      .eq("source", "fifa");
    const { count: fplLinked } = await supa
      .from("wc_players")
      .select("id", { count: "exact", head: true })
      .eq("source", "fifa")
      .not("fpl_id", "is", null);
    if ((fifaCount ?? 0) > 100 && (fplLinked ?? 0) < 80) {
      await enrichWcPlayersFromFpl(supa);
    }
  }

  const data = await fetchAllWcPlayerRows(supa);

  return hydrateWcPlayers(
    data.map((r) => mapWcPlayerRow(r)),
  );
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

async function buildWcXpRowsFromPlayers(
  players: WcPlayer[],
): Promise<{ matchdays: number[]; rows: WcXpRow[] }> {
  const teams = await loadTeams();
  const fixtures = await loadFixtures();
  const fdrLookup = buildWcFdrLookup(teams, fixtures);
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

export async function buildWcXpRows(position?: string): Promise<{
  matchdays: number[];
  rows: WcXpRow[];
}> {
  await ensureWcSeeded();
  let players = await loadPlayers();
  if (position && position !== "ALL") {
    players = players.filter((p) => p.position === position);
  }
  return buildWcXpRowsFromPlayers(players);
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
    price: p.price,
    selection_pct: p.selection_pct,
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
      "id,wc_team_id,name,fpl_id,position,price,selection_pct,goals,assists,xg,xa,form,minutes,season_club,season_league,club_source,wc_teams(code,short_name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return hydrateWcPlayer(mapWcPlayerRow(data as Record<string, unknown>));
}

export async function xpTotalForPlayer(
  playerId: number,
  players?: WcPlayer[],
): Promise<number> {
  const teams = await loadTeams();
  const fixtures = await loadFixtures();
  const fdrLookup = buildWcFdrLookup(teams, fixtures);
  const pool = players ?? (await loadPlayers());
  const player = pool.find((p) => p.id === playerId);
  if (!player) return 0;
  const [proj] = projectWcPlayers([player], teams, fixtures, fdrLookup);
  return proj?.xp_total ?? 0;
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

/** Full FPL season index for scouting exclusions and club display. */
export async function loadFplPlayerIndex(): Promise<FplPlayerIndex> {
  const supa = getServerSupabase();
  const { data: teams, error: tErr } = await supa
    .from("teams")
    .select("id,name,short_name");
  if (tErr) throw new Error(tErr.message);

  const clubNameById = new Map<number, string>();
  const teamShortById = new Map<number, string>();
  for (const t of teams ?? []) {
    clubNameById.set(t.id as number, t.name as string);
    teamShortById.set(t.id as number, t.short_name as string);
  }

  const { data, error } = await supa
    .from("players_static")
    .select(
      "fpl_id,web_name,name,team,position,team_id,goals_scored,assists,expected_goals,expected_assists,form,minutes",
    )
    .not("fpl_id", "is", null);
  if (error) throw new Error(error.message);

  const clubByFplId = new Map<number, string>();
  const shortByFplId = new Map<number, string>();
  for (const r of data ?? []) {
    const fplId = r.fpl_id as number;
    const tid = r.team_id as number | null;
    if (tid != null) {
      clubByFplId.set(fplId, clubNameById.get(tid) ?? "");
      shortByFplId.set(fplId, teamShortById.get(tid) ?? (r.team as string) ?? "");
    }
  }

  return buildFplPlayerIndex(
    (data ?? []) as Parameters<typeof buildFplPlayerIndex>[0],
    clubByFplId,
    shortByFplId,
  );
}

async function buildWcScoutingXpSnaps(
  players: WcPlayer[],
): Promise<Map<number, ScoutingXpSnap>> {
  const teams = await loadTeams();
  const fixtures = await loadFixtures();
  const fdrLookup = buildWcFdrLookup(teams, fixtures);
  const projections = projectWcPlayers(players, teams, fixtures, fdrLookup);
  const map = new Map<number, ScoutingXpSnap>();
  for (const p of projections) {
    const fdrs = p.fixtures.map((f) => f.fdr);
    const avg_fdr =
      fdrs.length > 0
        ? fdrs.reduce((s, f) => s + f, 0) / fdrs.length
        : 3;
    map.set(p.player.id, { xp_total: p.xp_total, avg_fdr });
  }
  return map;
}

export async function buildWcScouting(): Promise<WcScoutingReport> {
  await ensureWcSeeded();
  const [players, fplIndex] = await Promise.all([
    loadPlayers({ readOnly: true }),
    loadFplPlayerIndex(),
  ]);
  const fplIndexes = buildFplNameIndexes(fplIndex);
  const xpById = await buildWcScoutingXpSnaps(players);
  return buildWcScoutingReport(players, xpById, fplIndexes);
}
