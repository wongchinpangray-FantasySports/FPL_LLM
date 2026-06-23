import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getWcMiniMatchdayContext } from "@/lib/wc-mini/matchday";
import {
  mergePickWithDisplay,
  rowToMiniPlayerDisplay,
} from "@/lib/mini/player-stats";
import {
  WC_MINI_PLAYER_COLS,
  rowToWcMiniPlayerDisplay,
} from "@/lib/wc-mini/player-display";
import type { WcMiniEntryRow, WcMiniPickStored } from "@/lib/wc-mini/types";

export const dynamic = "force-dynamic";

function normalizeTag(raw: string | null): string | null {
  const tag = raw?.trim().toLowerCase();
  if (!tag || tag.length < 2 || tag.length > 40) return null;
  if (!/^[a-z0-9_-]+$/.test(tag)) return null;
  return tag;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entryTag = normalizeTag(searchParams.get("entry_tag"));
  if (!entryTag) {
    return NextResponse.json({ error: "Valid entry_tag required" }, { status: 400 });
  }

  const ctx = await getWcMiniMatchdayContext();
  const mdParam = searchParams.get("matchday");
  const matchday =
    mdParam != null && mdParam !== ""
      ? Number(mdParam)
      : ctx.submission_open && ctx.submission_matchday != null
        ? ctx.submission_matchday
        : ctx.scoring_matchday;

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("wc_mini_entries")
    .select(
      "entry_tag,matchday,season,entry_name,picks,captain_player_id,vice_player_id,updated_at",
    )
    .eq("entry_tag", entryTag)
    .eq("matchday", matchday)
    .eq("season", ctx.season)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ entry: null, matchday, season: ctx.season });
  }

  const entry = data as WcMiniEntryRow;
  const picks = (entry.picks ?? []) as WcMiniPickStored[];
  const ids = picks.map((p) => p.fpl_id);

  let enrichedPicks = picks;
  if (ids.length > 0) {
    const { data: rows } = await supa
      .from("wc_players")
      .select(WC_MINI_PLAYER_COLS)
      .in("id", ids);
    const byId = new Map(
      (rows ?? []).map((r) => [
        r.id as number,
        rowToWcMiniPlayerDisplay(r as Record<string, unknown>),
      ]),
    );
    enrichedPicks = picks.map((p) =>
      mergePickWithDisplay(p, byId.get(p.fpl_id)),
    );
  }

  return NextResponse.json({
    entry: { ...entry, picks: enrichedPicks },
    matchday,
    season: ctx.season,
    context: ctx,
  });
}
