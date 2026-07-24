import { NextResponse } from "next/server";
import { loadLastSeasonPointsForPlayers } from "@/lib/squad-builder/last-season-points";
import { getServerSupabase } from "@/lib/supabase";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,status,form,total_points,minutes,selected_by_percent,points_per_game,updated_at";

const SORT_COLUMNS = {
  price: "base_price",
  points: "total_points",
  ownership: "selected_by_percent",
  form: "form",
} as const;

type SortKey = keyof typeof SORT_COLUMNS;

function sanitizeQuery(q: string): string {
  return q
    .replace(/%/g, "")
    .replace(/[,*'"`;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

/** Browse players for Squad Builder (no min search length). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const position = searchParams.get("position");
  const teamId = searchParams.get("team_id");
  const sort = (searchParams.get("sort") ?? "price") as SortKey;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? 50) || 50, 10),
    100,
  );

  const q = sanitizeQuery(raw);
  const supa = getServerSupabase();
  let query = supa.from("players_static").select(COLS).limit(limit);

  if (q.length >= 1) {
    query = query.or(`web_name.ilike.%${q}%,name.ilike.%${q}%`);
  }

  if (position && ["GKP", "DEF", "MID", "FWD"].includes(position)) {
    query = query.eq("position", position);
  }
  if (teamId != null && teamId !== "") {
    const tid = Number(teamId);
    if (Number.isFinite(tid)) query = query.eq("team_id", tid);
  }

  const col = SORT_COLUMNS[sort] ?? SORT_COLUMNS.price;
  const ascending = sort === "price";
  query = query.order(col, { ascending, nullsFirst: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const fplIds = rows.map((r) => Number(r.fpl_id)).filter((id) => Number.isFinite(id));
  const { season: lastSeasonKey, points: lastSeasonMap } =
    await loadLastSeasonPointsForPlayers(fplIds);

  const players = rows.map((r) => ({
    ...r,
    base_price:
      r.base_price != null ? Math.round(Number(r.base_price) * 10) / 10 : null,
    last_season_points: lastSeasonMap.get(Number(r.fpl_id)) ?? null,
  }));

  return NextResponse.json(
    {
      players,
      lastSeasonKey,
      fetchedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
