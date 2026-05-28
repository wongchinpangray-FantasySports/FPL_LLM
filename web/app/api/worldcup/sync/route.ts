import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";
import { syncWcPlayersFromFifa } from "@/lib/wc/fifa-sync";
import { replaceExpandedWcPlayers } from "@/lib/wc/fpl-wc-pool";

export const dynamic = "force-dynamic";

/** Force-refresh WC player pool (FIFA API if configured, else expanded FPL fallback). */
export async function POST() {
  try {
    const supa = getServerSupabase();
    const { data: teams } = await supa.from("wc_teams").select("id,code");
    const teamByCode = new Map(
      (teams ?? []).map((t) => [t.code as string, t.id as number]),
    );
    const validCodes = new Set(WC_GROUP_TEAMS.map((t) => t.code));

    const fifa = await syncWcPlayersFromFifa();
    let expanded = 0;
    if (fifa.skipped || fifa.synced < 50) {
      expanded = await replaceExpandedWcPlayers(supa, teamByCode, validCodes);
    }

    const { count } = await supa
      .from("wc_players")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      fifa,
      expanded,
      total_players: count ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
