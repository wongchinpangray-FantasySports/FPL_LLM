import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerSupabase } from "@/lib/supabase";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import { isAdminEmail } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({
        user: null,
        profile: null,
        unread_count: 0,
      });
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({
        user: null,
        profile: null,
        unread_count: 0,
      });
    }

    const userId = authData.user.id;
    const admin = getServerSupabase();

    const [{ data: profile }, { count: unread }] = await Promise.all([
      admin
        .from("profiles")
        .select("id,display_name,fpl_entry_id,onboarding_completed_at,locale")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);

    if (!profile) {
      await admin.from("profiles").upsert({ id: userId });
    }

    return NextResponse.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile: profile ?? { id: userId, onboarding_completed_at: null },
      unread_count: unread ?? 0,
      is_admin: isAdminEmail(authData.user.email),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
