import { getAuthUser } from "@/lib/auth/session";
import { getServerSupabase } from "@/lib/supabase";

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes((email ?? "").trim().toLowerCase());
}

export async function requireAdminUser() {
  const user = await getAuthUser();
  if (!user) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!user.email || !isAdminEmail(user.email)) {
    const err = new Error("Forbidden");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return user;
}

export async function listAdminAuthUsers(): Promise<
  Array<{ id: string; email: string }>
> {
  const emails = new Set(getAdminEmails());
  if (emails.size === 0) return [];
  const admin = getServerSupabase();
  const found: Array<{ id: string; email: string }> = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    for (const u of data.users ?? []) {
      const email = (u.email ?? "").trim().toLowerCase();
      if (email && emails.has(email)) {
        found.push({ id: u.id, email });
      }
    }
    if (found.length >= emails.size) break;
    if ((data.users?.length ?? 0) < 200) break;
    page += 1;
  }
  return found;
}
