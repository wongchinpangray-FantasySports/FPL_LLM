import { getServerSupabase } from "@/lib/supabase";
import type { ToolHandler } from "./types";
import {
  loadRollingStats,
  projectPlayers,
  resolveCurrentGw,
  XP_SCORING_NOTE,
} from "@/lib/xp";

const PLAYER_COLS = [
  "fpl_id",
  "name",
  "web_name",
  "team",
  "team_id",
  "position",
  "base_price",
  "status",
  "news",
  "chance_of_playing",
  "form",
  "points_per_game",
  "total_points",
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "bonus",
  "bps",
  "ict_index",
  "expected_goals",
  "expected_assists",
  "expected_goal_involve",
  "selected_by_percent",
  "transfers_in_event",
  "transfers_out_event",
].join(",");

const POSITIONS = ["GKP", "DEF", "MID", "FWD"] as const;
type Position = (typeof POSITIONS)[number];

const SORTS = [
  "form",
  "total_points",
  "points_per_game",
  "expected_goal_involve",
  "ict_index",
  "selected_by_percent",
  "base_price",
] as const;
type SortBy = (typeof SORTS)[number];

const searchPlayers: ToolHandler = {
  name: "search_players",
  description:
    "Search for FPL players by position, team, max price, or other filters. Returns a ranked list of players matching the filters. Use this for questions like 'best midfielders under £8m' or 'top-scoring defenders this season'.",
  input_schema: {
    type: "object",
    properties: {
      position: {
        type: "string",
        enum: [...POSITIONS],
        description: "GKP, DEF, MID, or FWD.",
      },
      team: {
        type: "string",
        description: "Team name or short name (e.g. 'Arsenal', 'ARS'). Optional.",
      },
      max_price: {
        type: "number",
        description: "Maximum price in millions (e.g. 8.5 for £8.5m).",
      },
      min_price: {
        type: "number",
        description: "Minimum price in millions.",
      },
      min_minutes: {
        type: "integer",
        description:
          "Filter out players who have played fewer than this many minutes this season.",
      },
      sort_by: {
        type: "string",
        enum: [...SORTS],
        description:
          "Sort field. Defaults to 'form'. Use 'total_points' for season totals, 'expected_goal_involve' for xG+xA.",
      },
      limit: {
        type: "integer",
        description: "Max results (default 10, cap 25).",
      },
    },
  },
  async run(input) {
    const position = input.position as Position | undefined;
    const team = typeof input.team === "string" ? input.team : undefined;
    const maxPrice =
      typeof input.max_price === "number" ? input.max_price : undefined;
    const minPrice =
      typeof input.min_price === "number" ? input.min_price : undefined;
    const minMinutes =
      typeof input.min_minutes === "number" ? input.min_minutes : undefined;
    const sortBy = ((input.sort_by as SortBy) ?? "form") satisfies SortBy;
    const limit = Math.min(Math.max(Number(input.limit ?? 10) || 10, 1), 25);

    let q = getServerSupabase()
      .from("players_static")
      .select(PLAYER_COLS)
      .order(sortBy, { ascending: false, nullsFirst: false })
      .limit(limit);

    if (position) q = q.eq("position", position);
    if (maxPrice !== undefined) q = q.lte("base_price", maxPrice);
    if (minPrice !== undefined) q = q.gte("base_price", minPrice);
    if (minMinutes !== undefined) q = q.gte("minutes", minMinutes);
    if (team) q = q.ilike("team", `%${team}%`);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return {
      filters: { position, team, maxPrice, minPrice, minMinutes, sortBy, limit },
      count: data?.length ?? 0,
      players: data ?? [],
    };
  },
};

const getPlayer: ToolHandler = {
  name: "get_player",
  description:
    "Look up a single FPL player by name or fpl_id. Returns full stats including form, xG, xA, ownership and news/injury status.",
  input_schema: {
    type: "object",
    properties: {
      name_or_id: {
        type: "string",
        description:
          "Player name (partial OK, e.g. 'Saka', 'M.Salah') or numeric FPL ID.",
      },
    },
    required: ["name_or_id"],
  },
  async run(input) {
    const q = String(input.name_or_id ?? "").trim();
    if (!q) throw new Error("name_or_id is required");

    const supa = getServerSupabase();

    if (/^\d+$/.test(q)) {
      const { data, error } = await supa
        .from("players_static")
        .select(PLAYER_COLS)
        .eq("fpl_id", Number(q))
        .maybeSingle();
      if (error) throw new Error(error.message);
      return { match: data ?? null };
    }

    const pattern = `%${q}%`;
    const { data, error } = await supa
      .from("players_static")
      .select(PLAYER_COLS)
      .or(
        [
          `web_name.ilike.${pattern}`,
          `name.ilike.${pattern}`,
          `second_name.ilike.${pattern}`,
        ].join(","),
      )
      .order("total_points", { ascending: false, nullsFirst: false })
      .limit(5);
    if (error) throw new Error(error.message);

    return {
      query: q,
      match: data?.[0] ?? null,
      other_candidates: data?.slice(1) ?? [],
    };
  },
};

async function resolvePlayerIds(queries: string[]): Promise<
  Array<{ query: string; fpl_id: number | null }>
> {
  const supa = getServerSupabase();
  const out: Array<{ query: string; fpl_id: number | null }> = [];
  for (const q of queries) {
    if (/^\d+$/.test(q)) {
      out.push({ query: q, fpl_id: Number(q) });
      continue;
    }
    const pattern = `%${q}%`;
    const { data } = await supa
      .from("players_static")
      .select("fpl_id")
      .or(
        [
          `web_name.ilike.${pattern}`,
          `name.ilike.${pattern}`,
          `second_name.ilike.${pattern}`,
        ].join(","),
      )
      .order("total_points", { ascending: false, nullsFirst: false })
      .limit(1);
    out.push({ query: q, fpl_id: (data?.[0]?.fpl_id as number) ?? null });
  }
  return out;
}

const comparePlayers: ToolHandler = {
  name: "compare_players",
  description:
    "Compare 2+ players with rich metrics: per-90 xG/xA, last 6-GW rolling form (minutes, goals, assists, bonus, xG, xA, points), availability, price, ownership, and xP projection over the next N GWs (default 5) so the user can see who has the better outlook, not just season totals.",
  input_schema: {
    type: "object",
    properties: {
      names_or_ids: {
        type: "array",
        items: { type: "string" },
        description: "List of player names or FPL IDs to compare.",
      },
      horizon: {
        type: "integer",
        description: "Projection horizon in GWs (default 5, max 8).",
      },
    },
    required: ["names_or_ids"],
  },
  async run(input) {
    const raw = Array.isArray(input.names_or_ids) ? input.names_or_ids : [];
    const queries = raw
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
    if (queries.length < 2) {
      throw new Error("Provide at least two names_or_ids to compare.");
    }
    const horizon = Math.min(Math.max(Number(input.horizon ?? 5) || 5, 1), 8);
    const resolved = await resolvePlayerIds(queries);
    const ids = resolved
      .map((r) => r.fpl_id)
      .filter((v): v is number => typeof v === "number");

    const { current, next } = await resolveCurrentGw();
    const [projections, rolling] = await Promise.all([
      projectPlayers(ids, {
        currentGw: current,
        fromGw: next,
        toGw: next + horizon - 1,
      }),
      loadRollingStats(ids, current),
    ]);

    const supa = getServerSupabase();
    const { data: staticRows } = await supa
      .from("players_static")
      .select(PLAYER_COLS)
      .in("fpl_id", ids);
    const staticById = new Map<number, Record<string, unknown>>();
    for (const r of (staticRows ?? []) as unknown as Array<Record<string, unknown>>) {
      staticById.set(Number(r.fpl_id), r);
    }

    const payload = resolved.map((r) => {
      if (!r.fpl_id) return { query: r.query, match: null };
      const stat = staticById.get(r.fpl_id) ?? null;
      const proj = projections.get(r.fpl_id);
      const roll = rolling.get(r.fpl_id);
      const mins = Number(stat?.minutes ?? 0);
      const xg90 =
        mins > 0 ? (Number(stat?.expected_goals ?? 0) * 90) / mins : null;
      const xa90 =
        mins > 0 ? (Number(stat?.expected_assists ?? 0) * 90) / mins : null;
      const bonus90 =
        mins > 0 ? (Number(stat?.bonus ?? 0) * 90) / mins : null;

      return {
        query: r.query,
        fpl_id: r.fpl_id,
        player: stat
          ? {
              web_name: stat.web_name,
              name: stat.name,
              team: stat.team,
              position: stat.position,
              price: stat.base_price,
              status: stat.status,
              news: stat.news,
              chance_of_playing: stat.chance_of_playing,
              form: stat.form,
              ppg: stat.points_per_game,
              total_points: stat.total_points,
              minutes: stat.minutes,
              goals_scored: stat.goals_scored,
              assists: stat.assists,
              clean_sheets: stat.clean_sheets,
              bonus: stat.bonus,
              bps: stat.bps,
              selected_by_percent: stat.selected_by_percent,
              xg_season: stat.expected_goals,
              xa_season: stat.expected_assists,
              xg_per_90: xg90 != null ? Number(xg90.toFixed(3)) : null,
              xa_per_90: xa90 != null ? Number(xa90.toFixed(3)) : null,
              bonus_per_90: bonus90 != null ? Number(bonus90.toFixed(3)) : null,
            }
          : null,
        rolling: roll
          ? {
              window_gws: roll.window_gws,
              minutes: roll.minutes,
              starts: roll.starts,
              goals: roll.goals,
              assists: roll.assists,
              xg: Number(roll.xg.toFixed(2)),
              xa: Number(roll.xa.toFixed(2)),
              bonus: roll.bonus,
              bps: roll.bps,
              points: roll.points,
              points_per_game:
                roll.window_gws > 0
                  ? Number((roll.points / roll.window_gws).toFixed(2))
                  : null,
            }
          : null,
        projection: proj
          ? {
              xp_total: proj.xp_total,
              xp_per_game: proj.xp_per_game,
              value_per_million: proj.value_per_million,
              set_pieces: proj.set_pieces,
              fixtures: proj.fixtures.map((f) => ({
                gw: f.gw,
                opp: f.opp_short,
                home: f.home,
                xp: f.xp_total,
                opp_history_games: f.opp_history?.games ?? 0,
                opp_history_ppg: f.opp_history?.ppg ?? null,
              })),
            }
          : null,
      };
    });

    return {
      horizon,
      scoring: XP_SCORING_NOTE,
      players: payload,
    };
  },
};

const projectPoints: ToolHandler = {
  name: "project_points",
  description:
    "Project expected FPL points for one or more players across the next N gameweeks. Returns a full breakdown per fixture (expected minutes, team xG for/against, clean-sheet prob, xG, xA, bonus, points). Use this when the user asks 'how many points will X score' or wants to understand WHY a player is projected to do well/poorly.",
  input_schema: {
    type: "object",
    properties: {
      names_or_ids: {
        type: "array",
        items: { type: "string" },
        description: "Player names or FPL IDs.",
      },
      horizon: {
        type: "integer",
        description: "How many upcoming GWs to project (default 5, max 8).",
      },
    },
    required: ["names_or_ids"],
  },
  async run(input) {
    const raw = Array.isArray(input.names_or_ids) ? input.names_or_ids : [];
    const queries = raw
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
    if (queries.length === 0)
      throw new Error("names_or_ids is required");
    const horizon = Math.min(Math.max(Number(input.horizon ?? 5) || 5, 1), 8);

    const resolved = await resolvePlayerIds(queries);
    const ids = resolved
      .map((r) => r.fpl_id)
      .filter((v): v is number => typeof v === "number");
    const { current, next } = await resolveCurrentGw();
    const projections = await projectPlayers(ids, {
      currentGw: current,
      fromGw: next,
      toGw: next + horizon - 1,
    });

    return {
      horizon,
      scoring: XP_SCORING_NOTE,
      players: resolved.map((r) => {
        if (!r.fpl_id) return { query: r.query, match: null };
        const p = projections.get(r.fpl_id);
        if (!p) return { query: r.query, fpl_id: r.fpl_id, match: null };
        return {
          query: r.query,
          fpl_id: r.fpl_id,
          web_name: p.web_name,
          team: p.team,
          position: p.position,
          price: p.price,
          ownership: p.ownership,
          availability: p.availability,
          availability_note: p.availability_note,
          set_pieces: p.set_pieces,
          xp_total: p.xp_total,
          xp_per_game: p.xp_per_game,
          value_per_million: p.value_per_million,
          rolling: p.rolling,
          fixtures: p.fixtures,
        };
      }),
    };
  },
};

const getDifferentials: ToolHandler = {
  name: "get_differentials",
  description:
    "Find low-owned (under max_ownership%) players with high expected points over the next N GWs. Useful for rank-climbing differentials. Returns ranked shortlist with xP, ownership, price, and value_per_million.",
  input_schema: {
    type: "object",
    properties: {
      position: {
        type: "string",
        enum: [...POSITIONS],
        description: "Filter by position (optional).",
      },
      max_ownership: {
        type: "number",
        description: "Max selected-by-percent (default 10.0).",
      },
      min_price: {
        type: "number",
        description: "Minimum price in millions.",
      },
      max_price: {
        type: "number",
        description: "Max price in millions.",
      },
      horizon: {
        type: "integer",
        description: "Projection horizon in GWs (default 5, max 8).",
      },
      limit: {
        type: "integer",
        description: "Max results (default 10, cap 20).",
      },
    },
  },
  async run(input) {
    const supa = getServerSupabase();
    const position = input.position as Position | undefined;
    const maxOwn = Number(input.max_ownership ?? 10.0);
    const minPrice = Number(input.min_price ?? 0);
    const maxPrice = Number(input.max_price ?? 15.0);
    const horizon = Math.min(Math.max(Number(input.horizon ?? 5) || 5, 1), 8);
    const limit = Math.min(Math.max(Number(input.limit ?? 10) || 10, 1), 20);

    let q = supa
      .from("players_static")
      .select("fpl_id,position,base_price,selected_by_percent,status,chance_of_playing,minutes")
      .lte("selected_by_percent", maxOwn)
      .gte("base_price", minPrice)
      .lte("base_price", maxPrice)
      .gte("minutes", 270);
    if (position) q = q.eq("position", position);
    const { data: pool } = await q;

    const ids = (pool ?? [])
      .filter((r) => {
        const s = r.status ?? "a";
        if (s === "u" || s === "n" || s === "s") return false;
        const cop = r.chance_of_playing;
        if (typeof cop === "number" && cop < 75) return false;
        return true;
      })
      .map((r) => r.fpl_id as number);

    const { current, next } = await resolveCurrentGw();
    const projections = await projectPlayers(ids, {
      currentGw: current,
      fromGw: next,
      toGw: next + horizon - 1,
    });

    const ranked = Array.from(projections.values())
      .sort((a, b) => b.xp_total - a.xp_total)
      .slice(0, limit)
      .map((p) => ({
        fpl_id: p.fpl_id,
        web_name: p.web_name,
        team: p.team,
        position: p.position,
        price: p.price,
        ownership: p.ownership,
        set_pieces: p.set_pieces,
        xp_total: p.xp_total,
        xp_per_game: p.xp_per_game,
        value_per_million: p.value_per_million,
        form: p.form,
        fixtures: p.fixtures.map((f) => ({
          gw: f.gw,
          opp: f.opp_short,
          home: f.home,
          xp: f.xp_total,
          opp_history_games: f.opp_history?.games ?? 0,
        })),
      }));

    return {
      filters: { position, maxOwn, minPrice, maxPrice, horizon },
      scoring: XP_SCORING_NOTE,
      count: ranked.length,
      differentials: ranked,
    };
  },
};

export const playerTools: ToolHandler[] = [
  searchPlayers,
  getPlayer,
  comparePlayers,
  projectPoints,
  getDifferentials,
];
