import { redirect } from "@/i18n/navigation";
import { getAuthUser } from "@/lib/auth/session";

/** Redirect anonymous visitors to login before rendering a page. */
export async function requireSignedInPage(
  locale: string,
  returnPath: string,
): Promise<{ userId: string }> {
  const user = await getAuthUser();
  if (!user) {
    const next = encodeURIComponent(returnPath);
    redirect({
      href: `/auth/login?next=${next}`,
      locale,
    });
  }
  return { userId: user!.id };
}
