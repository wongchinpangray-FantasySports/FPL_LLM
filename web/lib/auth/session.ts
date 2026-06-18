import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserProfile = {
  id: string;
  display_name: string | null;
  fpl_entry_id: number | null;
  onboarding_completed_at: string | null;
  locale: string | null;
};

export type UserPreferences = {
  user_id: string;
  national_team_code: string | null;
  favorite_leagues: string[];
  fpl_team_id: number | null;
  followed_fpl_player_ids: number[];
  followed_wc_player_ids: number[];
  news_regions: string[];
};

export async function getAuthUser(): Promise<User | null> {
  try {
    const supa = createSupabaseServerClient();
    const { data, error } = await supa.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const supa = createSupabaseServerClient();
  const { data, error } = await supa
    .from("profiles")
    .select("id,display_name,fpl_entry_id,onboarding_completed_at,locale")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserProfile;
}

export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
