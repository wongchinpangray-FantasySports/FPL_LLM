import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const COLS =
  "fpl_id,web_name,name,team,team_id,position,base_price,status,form,total_points";

function sanitizeQuery(q: string): string {
  return q
    .replace(/%/g, "")
    .replace(/[,*'"`;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("q") ?? "";
  const position = searchParams.get("position");
  const maxPrice = searchParams.get("max_price");

  const q = sanitizeQuery(raw);
  if (q.length < 2) {
    return NextResponse.json({ players: [] satisfies unknown[] });
  }

  const supa = getServerSupabase();
  let query = supa
    .from("players_static")
    .select(COLS)
    .or(`web_name.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(20);

  if (position && ["GKP", "DEF", "MID", "FWD"].includes(position)) {
    query = query.eq("position", position);
  }
  if (maxPrice != null && maxPrice !== "") {
    const p = Number(maxPrice);
    if (Number.isFinite(p)) query = query.lte("base_price", p);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
