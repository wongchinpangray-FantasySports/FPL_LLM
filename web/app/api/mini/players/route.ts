import { NextResponse } from "next/server";
import {
  filterOfficialFplPlayers,
  getOfficialFplBrowsePlayers,
  type SquadBuilderPlayerSort,
} from "@/lib/squad-builder/fpl-live-players";
import {
  MINI_PLAYER_DISPLAY_COLS,
  rowToMiniPlayerDisplay,
  type MiniPlayerDisplay,
} from "@/lib/mini/player-stats";
import {
  minPlayerQueryLength,
  sanitizePlayerQuery,
} from "@/lib/fpl/player-search";
import { getServerSupabase } from "@/lib/supabase";

/** Browse / search current-season FPL players for Mini 5. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "";
  const position = searchParams.get("position");
  const sort = (searchParams.get("sort") ?? "form") as SquadBuilderPlayerSort;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 80) || 80, 10),
    200,
  );

  const q = sanitizePlayerQuery(raw);
  const hasQuery = q.length >= minPlayerQueryLength(q);

  try {
    const pool = await getOfficialFplBrowsePlayers();
    const { players: filtered, total } = filterOfficialFplPlayers(pool, {
      q: hasQuery ? q : "",
      locale,
      position:
        position && ["GKP", "DEF", "MID", "FWD"].includes(position)
          ? position
          : undefined,
      sort: ["price", "points", "ownership", "form"].includes(sort)
        ? sort
        : "form",
      limit,
    });

    if (filtered.length === 0) {
      return NextResponse.json({
        players: [] satisfies MiniPlayerDisplay[],
        total: 0,
      });
    }

    const ids = filtered.map((p) => p.fpl_id);
    const supa = getServerSupabase();
    const { data: staticRows } = await supa
      .from("players_static")
      .select(MINI_PLAYER_DISPLAY_COLS)
      .in("fpl_id", ids);

    const staticById = new Map(
      (staticRows ?? []).map((row) => [
        row.fpl_id as number,
        rowToMiniPlayerDisplay(row as Record<string, unknown>),
      ]),
    );

    const players: MiniPlayerDisplay[] = filtered.map((live) => {
      const enriched = staticById.get(live.fpl_id);
      if (enriched) return enriched;
      return {
        fpl_id: live.fpl_id,
        web_name: live.web_name,
        team: live.team,
        team_id: live.team_id,
        position: live.position,
        base_price: live.base_price,
        status: null,
        form: live.form,
        total_points: live.total_points,
        points_per_game: null,
        selected_by_percent: live.selected_by_percent,
        goals_scored: null,
        assists: null,
        expected_goals: null,
        expected_assists: null,
      };
    });

    return NextResponse.json(
      { players, total },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Player search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
