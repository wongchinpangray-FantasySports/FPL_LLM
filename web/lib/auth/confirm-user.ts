import { getServerSupabase } from "@/lib/supabase";

/** Single-page lookup — avoids paginated listUsers loops that exceed Worker CPU on Cloudflare. */
export async function findAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const admin = getServerSupabase();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error || !data.users.length) return null;
  return (
    data.users.find((u) => u.email?.toLowerCase() === normalized)?.id ?? null
  );
}

/** MVP: skip email verification gate — confirm immediately via service role. */
export async function confirmUserEmail(email: string): Promise<boolean> {
  const userId = await findAuthUserIdByEmail(email);
  if (!userId) return false;

  const admin = getServerSupabase();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  return !error;
}

export function isEmailNotConfirmedError(message: string): boolean {
  return /email not confirmed/i.test(message);
}
