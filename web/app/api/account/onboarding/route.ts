import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { upsertFplClubPreference } from "@/lib/auth/fpl-club-preference";

export const dynamic = "force-dynamic";

type OnboardingBody = {
  national_team_code?: string | null;
  favorite_leagues?: string[];
  fpl_team_id?: number | null;
  fpl_team_short_name?: string | null;
  followed_fpl_player_ids?: number[];
  followed_wc_player_ids?: number[];
  news_regions?: string[];
  fpl_entry_id?: number | null;
  display_name?: string | null;
  skip?: boolean;
};

export async function POST(req: Request) {
  try {
    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as OnboardingBody;
    const userId = authData.user.id;
    const admin = getServerSupabase();
    const now = new Date().toISOString();

    const profileUpdate: Record<string, unknown> = {
      id: userId,
      updated_at: now,
    };
    if (body.display_name != null) profileUpdate.display_name = body.display_name;
    if (body.fpl_entry_id != null) profileUpdate.fpl_entry_id = body.fpl_entry_id;
    if (body.skip || body.favorite_leagues != null) {
      profileUpdate.onboarding_completed_at = now;
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .upsert(profileUpdate);
    if (profileErr) throw new Error(profileErr.message);

    if (!body.skip) {
      if (body.fpl_team_short_name?.trim()) {
        await upsertFplClubPreference(
          admin,
          userId,
          body.fpl_team_short_name.trim(),
        );
      }

      const prefRow: Record<string, unknown> = {
        user_id: userId,
        national_team_code: body.national_team_code ?? null,
        favorite_leagues: body.favorite_leagues ?? [],
        followed_fpl_player_ids: body.followed_fpl_player_ids ?? [],
        followed_wc_player_ids: body.followed_wc_player_ids ?? [],
        news_regions:
          body.news_regions && body.news_regions.length > 0
            ? body.news_regions
            : ["GLOBAL"],
        updated_at: now,
      };
      if (!body.fpl_team_short_name?.trim()) {
        prefRow.fpl_team_id = body.fpl_team_id ?? null;
      }

      const { error: prefErr } = await admin
        .from("user_preferences")
        .upsert(prefRow);
      if (prefErr) throw new Error(prefErr.message);
    } else {
      await admin.from("profiles").update({ onboarding_completed_at: now }).eq("id", userId);
    }

    const { data: existingWelcome } = await admin
      .from("user_notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "welcome")
      .limit(1);

    if (!existingWelcome?.length) {
      await admin.from("user_notifications").insert({
        user_id: userId,
        type: "welcome",
        title: "Welcome to FALEAGUE AI",
        body: "Your inbox will collect news matched to your favourite teams and players.",
        href: "/inbox",
      });
    }

    return NextResponse.json({ ok: true, onboarding_completed_at: now });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Onboarding failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
