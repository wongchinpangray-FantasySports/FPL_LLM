import { NextResponse } from "next/server";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getServerSupabase } from "@/lib/supabase";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,status,form,total_points,minutes,selected_by_percent,points_per_game";

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

async function loadLastSeasonPoints(
  fplIds: number[],
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (fplIds.length === 0) return out;

  const currentSeason = await getCurrentFplSeason();
  const prevSeason = String(Number(currentSeason) - 1);
  if (!Number.isFinite(Number(prevSeason))) return out;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("player_gw_stats")
    .select("player_id,total_points")
    .eq("season", prevSeason)
    .in("player_id", fplIds);

  if (error) return out;

  for (const row of data ?? []) {
    const id = Number(row.player_id);
    if (!Number.isFinite(id)) continue;
    out.set(id, (out.get(id) ?? 0) + Number(row.total_points ?? 0));
  }
  return out;
}

/** Browse players for Squad Builder (no min search length). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const position = searchParams.get("position");
  const teamId = searchParams.get("team_id");
  const maxPrice = searchParams.get("max_price");
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
  if (maxPrice != null && maxPrice !== "") {
    const p = Number(maxPrice);
    if (Number.isFinite(p)) query = query.lte("base_price", p);
  }

  const col = SORT_COLUMNS[sort] ?? SORT_COLUMNS.price;
  const ascending = sort === "price";
  query = query.order(col, { ascending, nullsFirst: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const lastSeasonMap = await loadLastSeasonPoints(
    rows.map((r) => Number(r.fpl_id)).filter((id) => Number.isFinite(id)),
  );

  const players = rows.map((r) => ({
    ...r,
    last_season_points: lastSeasonMap.get(Number(r.fpl_id)) ?? null,
  }));

  return NextResponse.json(
    { players },
    { headers: { "Cache-Control": "no-store" } },
  );
}
