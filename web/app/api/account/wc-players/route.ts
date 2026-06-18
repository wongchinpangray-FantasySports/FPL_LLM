import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  if (q.length < 2) {
    return NextResponse.json({ players: [] });
  }

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_players")
    .select("id,name,position,wc_teams(code,short_name)")
    .ilike("name", `%${q}%`)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const players = (data ?? []).map((row) => {
    const teamRaw = row.wc_teams as
      | { code: string; short_name: string }
      | { code: string; short_name: string }[]
      | null;
    const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
    return {
      id: row.id as number,
      name: row.name as string,
      position: row.position as string,
      team_code: team?.code ?? null,
    };
  });

  return NextResponse.json({ players });
}
