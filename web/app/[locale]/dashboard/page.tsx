import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { PageShell } from "@/components/page-shell";
import { FplEntryLinkForm } from "@/components/account/fpl-entry-link-form";
import { getUserProfile, requireAuthUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardIndexPage({
  params,
}: {
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  const dt = await getTranslations({
    locale: params.locale,
    namespace: "dashboard",
  });
  const t = await getTranslations({
    locale: params.locale,
    namespace: "dashboardIndex",
  });

  const user = await requireAuthUser();
  const profile = await getUserProfile(user.id);
  if (profile?.fpl_entry_id) {
    redirect({
      href: `/dashboard/${profile.fpl_entry_id}`,
      locale: params.locale,
    });
  }

  return (
    <PageShell
      backHref="/"
      backLabel={dt("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("linkEntryDescription")}
      width="2xl"
    >
      <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <FplEntryLinkForm />
        <p className="mt-4 text-xs text-muted-foreground">
          {t("linkEntryAccountHint")}{" "}
          <Link href="/account" className="text-brand-accent hover:underline">
            {t("linkEntryAccountLink")}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}
