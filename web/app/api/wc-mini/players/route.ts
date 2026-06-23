import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
  const q = sanitizeQuery(searchParams.get("q") ?? "");
  const position = searchParams.get("position");

  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  let query = getServerSupabase()
    .from("wc_players")
    .select(
      "id,name,position,price,form,goals,assists,wc_team_id,wc_teams(short_name,code)",
    )
    .ilike("name", `%${q}%`)
    .limit(20);

  if (position === "GKP") {
    query = query.eq("position", "GKP");
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = (data ?? []).map((row) => {
    const teamRaw = row.wc_teams as
      | { short_name: string; code: string }
      | { short_name: string; code: string }[]
      | null;
    const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
    return {
      fpl_id: row.id as number,
      web_name: row.name as string,
      team: team?.short_name ?? team?.code ?? null,
      team_id: row.wc_team_id as number,
      position: row.position as string,
      base_price: row.price as number | null,
      status: null,
      form: row.form as number | null,
      total_points: null,
      points_per_game: null,
      selected_by_percent: null,
      goals_scored: row.goals as number | null,
      assists: row.assists as number | null,
      expected_goals: null,
      expected_assists: null,
    };
  });

  return NextResponse.json({ players });
}
