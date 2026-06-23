import { getAuthUser } from "@/lib/auth/session";

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
