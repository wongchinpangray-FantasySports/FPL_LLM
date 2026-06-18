import { getServerSupabase } from "@/lib/supabase";

/** Count one login per calendar day (UTC). */
export async function recordLoginDay(userId: string): Promise<void> {
  const admin = getServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await admin
    .from("profiles")
    .select("login_days,last_login_date")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await admin.from("profiles").upsert({
      id: userId,
      login_days: 1,
      last_login_date: today,
    });
    return;
  }

  if (profile.last_login_date === today) return;

  await admin
    .from("profiles")
    .update({
      login_days: (profile.login_days as number) + 1,
      last_login_date: today,
    })
    .eq("id", userId);
}
