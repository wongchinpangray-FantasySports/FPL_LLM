import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildEpl2627ClubOptions,
  syncEpl2627ClubTeams,
} from "@/lib/fpl/epl-2627-clubs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getServerSupabase();

    const [{ data: fplTeamsRaw }, { data: wcTeams }] = await Promise.all([
      admin.from("teams").select("id,name,short_name").order("name"),
      admin
        .from("wc_teams")
        .select("code,name,short_name,group_letter")
        .order("name"),
    ]);

    const fplTeams = fplTeamsRaw ?? [];
    await syncEpl2627ClubTeams(admin, fplTeams);

    return NextResponse.json({
      fpl_teams: buildEpl2627ClubOptions(fplTeams),
      wc_teams: wcTeams ?? [],
      leagues: [
        { id: "epl", label: "Premier League" },
        { id: "wc", label: "World Cup" },
      ],
      news_regions: ["US", "UK", "EU", "LATAM", "APAC", "GLOBAL"],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
