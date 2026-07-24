import { redirect } from "@/i18n/navigation";
import { getUserProfile, requireAuthUser } from "@/lib/auth/session";

/** Ensure signed-in user owns this Entry ID; redirect otherwise. */
export async function ensureFplEntryPage(
  entryId: number,
  locale: string,
): Promise<{
  userId: string;
}> {
  const user = await requireAuthUser();
  const profile = await getUserProfile(user.id);
  const linkedEntryId = profile?.fpl_entry_id ?? null;
  if (linkedEntryId == null) {
    redirect({ href: "/account", locale });
  }

  if (linkedEntryId !== entryId) {
    redirect({ href: `/dashboard/${linkedEntryId}`, locale });
  }

  return { userId: user.id };
}
