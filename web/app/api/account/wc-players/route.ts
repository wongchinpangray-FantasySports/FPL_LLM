import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import {
  isChineseLocale,
  loadWcPlayerZhSearchMap,
  minPlayerQueryLength,
  sanitizePlayerQuery,
  scorePlayerSearchMatch,
  wcPlayerSearchFields,
} from "@/lib/fpl/player-search";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locale = searchParams.get("locale") ?? "";
  const q = sanitizePlayerQuery(searchParams.get("q") ?? "");
  if (q.length < minPlayerQueryLength(q)) {
    return NextResponse.json({ players: [] });
  }

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_players")
    .select("id,name,position,wc_teams(code,short_name)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const zhMap = isChineseLocale(locale) ? await loadWcPlayerZhSearchMap() : undefined;
  const players = (data ?? [])
    .map((row) => {
      const teamRaw = row.wc_teams as
        | { code: string; short_name: string }
        | { code: string; short_name: string }[]
        | null;
      const team = Array.isArray(teamRaw) ? teamRaw[0] : teamRaw;
      const searchRow = wcPlayerSearchFields({ name: row.name as string });
      return {
        id: row.id as number,
        name: row.name as string,
        position: row.position as string,
        team_code: team?.code ?? null,
        _score: scorePlayerSearchMatch(searchRow, q, { locale, zhMap }),
      };
    })
    .filter((row) => row._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 20)
    .map(({ _score: _, ...player }) => player);

  return NextResponse.json({ players });
}
