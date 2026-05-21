import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import type { MiniEntryRow } from "@/lib/mini/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entryId = Number(searchParams.get("entry_id"));
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "Valid entry_id required" }, { status: 400 });
  }

  const ctx = await getMiniGameweekContext();
  const gwParam = searchParams.get("gw");
  const gw =
    gwParam != null && gwParam !== ""
      ? Number(gwParam)
      : (ctx.submission_open && ctx.submission_gw != null
          ? ctx.submission_gw
          : ctx.scoring_gw);

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("mini_entries")
    .select(
      "entry_id,gw,season,entry_name,picks,captain_fpl_id,vice_fpl_id,updated_at",
    )
    .eq("entry_id", entryId)
    .eq("gw", gw)
    .eq("season", ctx.season)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ entry: null, gw, season: ctx.season });
  }

  return NextResponse.json({
    entry: data as MiniEntryRow,
    gw,
    season: ctx.season,
    context: ctx,
  });
}
