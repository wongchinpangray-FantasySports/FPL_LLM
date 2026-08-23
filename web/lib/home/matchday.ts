import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { fplDcPoints } from "@/lib/fpl/dc-points";

export type MatchdayFixtureChip = {
  fixture_id: number;
  gw: number;
  home_short: string;
  away_short: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  finished: boolean;
  started: boolean;
  kickoff_time: string | null;
};

export type MatchdayTopPlayer = {
  fpl_id: number;
  web_name: string;
  team: string | null;
  position: string;
  total_points: number;
};

export type MatchdayTickerPayload = {
  season: string;
  gw: number | null;
  fixtures: MatchdayFixtureChip[];
  topPlayers: MatchdayTopPlayer[];
};

export type MatchStatPlayer = {
  fpl_id: number;
  web_name: string;
  team: string | null;
  position: string | null;
  goals_scored: number;
  assists: number;
  bps: number;
  bonus: number;
  defensive_contribution: number;
  defcon_points: number;
  total_points: number;
  minutes: number;
};

export type MatchdayDetailPayload = {
  fixture: MatchdayFixtureChip;
  scorers: MatchStatPlayer[];
  assisters: MatchStatPlayer[];
  bpsLeaders: MatchStatPlayer[];
  bonusWinners: MatchStatPlayer[];
  defcon: MatchStatPlayer[];
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function resolveTickerGw(
  season: string,
): Promise<{ gw: number | null; fixtures: MatchdayFixtureChip[] }> {
  const supa = getServerSupabase();

  const { data: gws } = await supa
    .from("gameweeks")
    .select("id,is_current,is_next,finished")
    .order("id", { ascending: true });

  const current =
    gws?.find((g) => g.is_current) ?? gws?.find((g) => g.is_next) ?? null;
  const lastFinished = [...(gws ?? [])]
    .reverse()
    .find((g) => g.finished);
  const candidateGws = [
    current?.id as number | undefined,
    lastFinished?.id as number | undefined,
  ].filter((g): g is number => typeof g === "number" && g > 0);

  const { data: teams } = await supa.from("teams").select("id,name,short_name");
  const teamMap = new Map(
    (teams ?? []).map((t) => [
      Number(t.id),
      {
        name: String(t.name ?? ""),
        short: String(t.short_name ?? t.name ?? ""),
      },
    ]),
  );

  async function loadGw(gw: number): Promise<MatchdayFixtureChip[]> {
    const { data } = await supa
      .from("fixtures")
      .select(
        "id,gw,kickoff_time,home_team_id,away_team_id,home_team_score,away_team_score,finished,started",
      )
      .eq("season", season)
      .eq("gw", gw)
      .order("kickoff_time", { ascending: true });

    return (data ?? []).map((f) => {
      const home = teamMap.get(Number(f.home_team_id));
      const away = teamMap.get(Number(f.away_team_id));
      return {
        fixture_id: Number(f.id),
        gw: Number(f.gw),
        home_short: home?.short || `#${f.home_team_id}`,
        away_short: away?.short || `#${f.away_team_id}`,
        home_name: home?.name || home?.short || String(f.home_team_id),
        away_name: away?.name || away?.short || String(f.away_team_id),
        home_score:
          f.home_team_score == null ? null : Number(f.home_team_score),
        away_score:
          f.away_team_score == null ? null : Number(f.away_team_score),
        finished: Boolean(f.finished),
        started: Boolean(f.started),
        kickoff_time: f.kickoff_time ? String(f.kickoff_time) : null,
      };
    });
  }

  for (const gw of candidateGws) {
    const fixtures = await loadGw(gw);
    const interesting = fixtures.filter((f) => f.started || f.finished);
    if (interesting.length > 0) {
      return { gw, fixtures: interesting };
    }
  }

  if (candidateGws[0] != null) {
    const fixtures = await loadGw(candidateGws[0]);
    return { gw: candidateGws[0], fixtures };
  }

  return { gw: null, fixtures: [] };
}

export async function loadMatchdayTicker(): Promise<MatchdayTickerPayload> {
  const season = await getCurrentFplSeason();
  const { gw, fixtures } = await resolveTickerGw(season);
  const supa = getServerSupabase();

  const { data: players } = await supa
    .from("players_static")
    .select("fpl_id,web_name,team,position,total_points")
    .order("total_points", { ascending: false })
    .limit(11);

  const topPlayers: MatchdayTopPlayer[] = (players ?? []).map((p) => ({
    fpl_id: Number(p.fpl_id),
    web_name: String(p.web_name ?? `#${p.fpl_id}`),
    team: p.team != null ? String(p.team) : null,
    position: String(p.position ?? "?"),
    total_points: num(p.total_points),
  }));

  return { season, gw, fixtures, topPlayers };
}

export async function loadMatchdayDetail(
  fixtureId: number,
): Promise<MatchdayDetailPayload | null> {
  if (!Number.isFinite(fixtureId) || fixtureId <= 0) return null;

  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();

  const { data: fix } = await supa
    .from("fixtures")
    .select(
      "id,gw,kickoff_time,home_team_id,away_team_id,home_team_score,away_team_score,finished,started,season",
    )
    .eq("id", fixtureId)
    .maybeSingle();

  if (!fix) return null;

  const seasonKey = String(fix.season ?? season);
  const teamIds = [Number(fix.home_team_id), Number(fix.away_team_id)];
  const { data: teams } = await supa
    .from("teams")
    .select("id,name,short_name")
    .in("id", teamIds);
  const teamMap = new Map(
    (teams ?? []).map((t) => [
      Number(t.id),
      {
        name: String(t.name ?? ""),
        short: String(t.short_name ?? t.name ?? ""),
      },
    ]),
  );
  const home = teamMap.get(Number(fix.home_team_id));
  const away = teamMap.get(Number(fix.away_team_id));

  const fixture: MatchdayFixtureChip = {
    fixture_id: Number(fix.id),
    gw: Number(fix.gw),
    home_short: home?.short || `#${fix.home_team_id}`,
    away_short: away?.short || `#${fix.away_team_id}`,
    home_name: home?.name || home?.short || String(fix.home_team_id),
    away_name: away?.name || away?.short || String(fix.away_team_id),
    home_score: fix.home_team_score == null ? null : Number(fix.home_team_score),
    away_score: fix.away_team_score == null ? null : Number(fix.away_team_score),
    finished: Boolean(fix.finished),
    started: Boolean(fix.started),
    kickoff_time: fix.kickoff_time ? String(fix.kickoff_time) : null,
  };

  const { data: rows } = await supa
    .from("player_gw_stats")
    .select(
      "player_id,minutes,goals_scored,assists,bps,bonus,defensive_contribution,total_points",
    )
    .eq("season", seasonKey)
    .eq("fixture_id", fixtureId);

  const playerIds = [
    ...new Set((rows ?? []).map((r) => Number(r.player_id)).filter((n) => n > 0)),
  ];

  const { data: players } =
    playerIds.length > 0
      ? await supa
          .from("players_static")
          .select("fpl_id,web_name,team,position")
          .in("fpl_id", playerIds)
      : { data: [] as { fpl_id: number; web_name: string | null; team: string | null; position: string | null }[] };

  const playerMap = new Map(
    (players ?? []).map((p) => [Number(p.fpl_id), p] as const),
  );

  const stats: MatchStatPlayer[] = (rows ?? []).map((r) => {
    const id = Number(r.player_id);
    const meta = playerMap.get(id);
    const dc = num(r.defensive_contribution);
    const position = meta?.position != null ? String(meta.position) : null;
    return {
      fpl_id: id,
      web_name: String(meta?.web_name ?? `#${id}`),
      team: meta?.team != null ? String(meta.team) : null,
      position,
      goals_scored: num(r.goals_scored),
      assists: num(r.assists),
      bps: num(r.bps),
      bonus: num(r.bonus),
      defensive_contribution: dc,
      defcon_points: fplDcPoints(position, dc),
      total_points: num(r.total_points),
      minutes: num(r.minutes),
    };
  });

  const scorers = stats
    .filter((p) => p.goals_scored > 0)
    .sort((a, b) => b.goals_scored - a.goals_scored || b.total_points - a.total_points);
  const assisters = stats
    .filter((p) => p.assists > 0)
    .sort((a, b) => b.assists - a.assists || b.total_points - a.total_points);
  const bpsLeaders = [...stats]
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.bps - a.bps)
    .slice(0, 5);
  const bonusWinners = stats
    .filter((p) => p.bonus > 0)
    .sort((a, b) => b.bonus - a.bonus || b.bps - a.bps);
  const defcon = stats
    .filter((p) => p.defcon_points > 0 || p.defensive_contribution > 0)
    .sort(
      (a, b) =>
        b.defcon_points - a.defcon_points ||
        b.defensive_contribution - a.defensive_contribution,
    )
    .slice(0, 8);

  return {
    fixture,
    scorers,
    assisters,
    bpsLeaders,
    bonusWinners,
    defcon,
  };
}
