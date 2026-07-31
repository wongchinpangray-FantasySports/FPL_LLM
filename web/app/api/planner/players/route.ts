import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  isChineseLocale,
  loadFplPlayerZhSearchMap,
  minPlayerQueryLength,
  rankPlayerSearchResults,
  sanitizePlayerQuery,
} from "@/lib/fpl/player-search";

const COLS =
  "fpl_id,web_name,name,first_name,second_name,team,team_id,position,base_price,status,form,total_points,minutes,selected_by_percent,points_per_game,ict_index,goals_scored,assists,expected_goals,expected_assists";

const loadPlannerSearchPool = unstable_cache(
  async () => {
    const supa = getServerSupabase();
    const { data, error } = await supa.from("players_static").select(COLS);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["planner-player-search-pool-v1"],
  { revalidate: 300 },
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const locale = searchParams.get("locale") ?? "";
  const position = searchParams.get("position");
  const maxPrice = searchParams.get("max_price");

  const q = sanitizePlayerQuery(raw);
  if (q.length < minPlayerQueryLength(q)) {
    return NextResponse.json({ players: [] satisfies unknown[] });
  }

  try {
    let pool = await loadPlannerSearchPool();

    if (position && ["GKP", "DEF", "MID", "FWD"].includes(position)) {
      pool = pool.filter((p) => p.position === position);
    }
    if (maxPrice != null && maxPrice !== "") {
      const p = Number(maxPrice);
      if (Number.isFinite(p)) {
        pool = pool.filter(
          (row) => row.base_price == null || Number(row.base_price) <= p,
        );
      }
    }

    const zhMap = isChineseLocale(locale)
      ? await loadFplPlayerZhSearchMap()
      : undefined;
    const players = rankPlayerSearchResults(pool, q, {
      locale,
      zhMap,
      limit: 20,
    });

    return NextResponse.json({ players });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Player search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
