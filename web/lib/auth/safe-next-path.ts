import { stripLocalePrefix } from "@/i18n/routing";

/** Allow only password-reset destinations after the auth callback. */
export function safePasswordResetNextPath(next: string | null): string | null {
  if (!next?.startsWith("/") || next.startsWith("//")) return null;
  const stripped = stripLocalePrefix(next);
  if (stripped !== "/auth/reset-password") return null;
  return next;
}
