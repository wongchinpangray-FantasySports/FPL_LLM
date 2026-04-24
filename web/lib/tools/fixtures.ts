import { getServerSupabase } from "@/lib/supabase";
import type { ToolHandler } from "./types";

async function currentGw(): Promise<number> {
  const supa = getServerSupabase();
  const { data } = await supa
    .from("gameweeks")
    .select("id,is_current,is_next,finished")
    .order("id", { ascending: true });
  if (!data) return 1;
  const cur = data.find((g) => g.is_current) ?? data.find((g) => g.is_next);
  if (cur) return cur.id as number;
  const lastFinished = [...data].reverse().find((g) => g.finished);
  return ((lastFinished?.id as number | undefined) ?? 0) + 1;
}

async function teamMap(): Promise<Record<number, { name: string; short: string }>> {
  const supa = getServerSupabase();
  const { data } = await supa.from("teams").select("id,name,short_name");
  const out: Record<number, { name: string; short: string }> = {};
  for (const t of data ?? []) {
    out[t.id as number] = {
      name: t.name as string,
      short: t.short_name as string,
    };
  }
  return out;
}

async function resolveTeamId(query: string): Promise<number | null> {
  const supa = getServerSupabase();
  const q = query.trim();
  if (/^\d+$/.test(q)) return Number(q);
  const { data } = await supa
    .from("teams")
    .select("id,name,short_name")
    .or(`name.ilike.%${q}%,short_name.ilike.%${q}%`)
    .limit(1);
  return (data?.[0]?.id as number | undefined) ?? null;
}

const getFixtures: ToolHandler = {
  name: "get_fixtures",
  description:
    "Get upcoming (or past) fixtures. Optionally filter by team and GW range. Each fixture includes home/away teams, kickoff time, and FDR (fixture difficulty rating).",
  input_schema: {
    type: "object",
    properties: {
      team: {
        type: "string",
        description: "Team name or short name (e.g. 'Arsenal', 'ARS').",
      },
      from_gw: {
        type: "integer",
        description: "Starting gameweek. Defaults to the current GW.",
      },
      to_gw: {
        type: "integer",
        description: "Ending gameweek (inclusive). Defaults to from_gw + 4.",
      },
      include_finished: {
        type: "boolean",
        description: "Include already-finished fixtures. Default false.",
      },
    },
  },
  async run(input) {
    const supa = getServerSupabase();
    const tmap = await teamMap();
    const cur = await currentGw();
    const fromGw = Number(input.from_gw ?? cur) || cur;
    const toGw = Number(input.to_gw ?? fromGw + 4) || fromGw + 4;
    const includeFinished = Boolean(input.include_finished ?? false);

    let teamId: number | null = null;
    if (typeof input.team === "string" && input.team.trim()) {
      teamId = await resolveTeamId(input.team);
      if (!teamId) return { fixtures: [], error: `team '${input.team}' not found` };
    }

    let q = supa
      .from("fixtures")
      .select(
        "id,gw,kickoff_time,home_team_id,away_team_id,home_team_score,away_team_score,home_fdr,away_fdr,finished,started,minutes",
      )
      .gte("gw", fromGw)
      .lte("gw", toGw)
      .order("gw", { ascending: true })
      .order("kickoff_time", { ascending: true });

    if (!includeFinished) q = q.eq("finished", false);
    if (teamId !== null)
      q = q.or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return {
      current_gw: cur,
      from_gw: fromGw,
      to_gw: toGw,
      fixtures: (data ?? []).map((f) => ({
        id: f.id,
        gw: f.gw,
        kickoff_time: f.kickoff_time,
        home: tmap[f.home_team_id as number]?.short ?? f.home_team_id,
        away: tmap[f.away_team_id as number]?.short ?? f.away_team_id,
        home_fdr: f.home_fdr,
        away_fdr: f.away_fdr,
        finished: f.finished,
        score:
          f.home_team_score !== null && f.away_team_score !== null
            ? `${f.home_team_score}-${f.away_team_score}`
            : null,
      })),
    };
  },
};

const getFdr: ToolHandler = {
  name: "get_fdr",
  description:
    "Compute a fixture-difficulty summary for one or more teams over the next N gameweeks. Returns each team's fixtures with FDR and the sum/average.",
  input_schema: {
    type: "object",
    properties: {
      teams: {
        type: "array",
        items: { type: "string" },
        description: "Team names or short names.",
      },
      horizon: {
        type: "integer",
        description: "Number of upcoming GWs to consider (default 5, max 10).",
      },
    },
    required: ["teams"],
  },
  async run(input) {
    const supa = getServerSupabase();
    const tmap = await teamMap();
    const cur = await currentGw();
    const horizon = Math.min(
      Math.max(Number(input.horizon ?? 5) || 5, 1),
      10,
    );
    const rawTeams = Array.isArray(input.teams) ? input.teams : [];
    const teamQueries = rawTeams.map((v) => String(v).trim()).filter(Boolean);
    if (teamQueries.length === 0) throw new Error("teams array is required");

    const results = [] as unknown[];
    for (const tq of teamQueries) {
      const tid = await resolveTeamId(tq);
      if (!tid) {
        results.push({ team: tq, error: "not found" });
        continue;
      }
      const { data, error } = await supa
        .from("fixtures")
        .select("gw,home_team_id,away_team_id,home_fdr,away_fdr,finished")
        .gte("gw", cur)
        .lt("gw", cur + horizon)
        .or(`home_team_id.eq.${tid},away_team_id.eq.${tid}`)
        .order("gw", { ascending: true });
      if (error) throw new Error(error.message);

      const rows = (data ?? []).map((f) => {
        const isHome = f.home_team_id === tid;
        const opp = isHome ? f.away_team_id : f.home_team_id;
        const fdr = isHome ? f.home_fdr : f.away_fdr;
        return {
          gw: f.gw,
          opp: tmap[opp as number]?.short ?? String(opp),
          home: isHome,
          fdr: fdr as number | null,
        };
      });
      const fdrs = rows.map((r) => r.fdr).filter((v): v is number => v !== null);
      results.push({
        team: tmap[tid]?.name ?? tq,
        short: tmap[tid]?.short ?? tq,
        fixtures: rows,
        total_fdr: fdrs.reduce((a, b) => a + b, 0),
        avg_fdr: fdrs.length
          ? Number((fdrs.reduce((a, b) => a + b, 0) / fdrs.length).toFixed(2))
          : null,
      });
    }

    return { current_gw: cur, horizon, teams: results };
  },
};

export const fixtureTools: ToolHandler[] = [getFixtures, getFdr];
