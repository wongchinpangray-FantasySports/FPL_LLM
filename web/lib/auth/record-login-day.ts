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
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const lastDate = profile.last_login_date
    ? String(profile.last_login_date).slice(0, 10)
    : null;
  if (lastDate === today) return;

  await admin
    .from("profiles")
    .update({
      login_days: ((profile.login_days as number) || 0) + 1,
      last_login_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}
