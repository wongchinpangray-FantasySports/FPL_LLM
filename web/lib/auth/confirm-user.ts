import { getServerSupabase } from "@/lib/supabase";

export async function findAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  const admin = getServerSupabase();
  const normalized = email.trim().toLowerCase();
  let page = 1;

  for (let i = 0; i < 10; i++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data.users.length) return null;

    const match = data.users.find(
      (u) => u.email?.toLowerCase() === normalized,
    );
    if (match) return match.id;

    if (!data.nextPage || data.nextPage <= page) return null;
    page = data.nextPage;
  }

  return null;
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
