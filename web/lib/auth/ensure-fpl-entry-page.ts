import { redirect } from "@/i18n/navigation";
import { getAuthUser, getUserProfile, requireAuthUser } from "@/lib/auth/session";

/** Require signed-in user with a linked default Entry ID; any valid entryId in URL is allowed. */
export async function ensureFplEntryPage(
  entryId: number,
  locale: string,
): Promise<{
  userId: string;
}> {
  // Local preview: skip auth so /dashboard/[id] works on localhost without login.
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  ) {
    const user = await getAuthUser();
    if (!user) return { userId: "local-preview" };
    return { userId: user.id };
  }

  const user = await requireAuthUser();
  const profile = await getUserProfile(user.id);
  const linkedEntryId = profile?.fpl_entry_id ?? null;
  if (linkedEntryId == null) {
    redirect({ href: "/account", locale });
  }

  return { userId: user.id };
}
