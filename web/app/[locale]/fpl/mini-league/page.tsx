import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { MiniLeagueApp } from "@/components/fpl/mini-league/mini-league-app";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { FplEntryLinkForm } from "@/components/account/fpl-entry-link-form";
import { getAuthUser, getUserProfile } from "@/lib/auth/session";
import {
  canAccessPremiumFeature,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { Link } from "@/i18n/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function MiniLeaguePage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "miniLeague" });
  const user = await getAuthUser();
  const profile = user ? await getUserProfile(user.id) : null;
  const allowed = await canAccessPremiumFeature(user?.id);
  const enforce = isInsightsPremiumEnforced();
  const localPreview =
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1";

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
      actions={
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
          {t("badgePro")}
        </span>
      }
    >
      {!allowed && enforce ? (
        <InsightsPaywall
          title={t("paywallTitle")}
          body={t("paywallBody")}
          signInLabel={t("paywallSignIn")}
          upgradeLabel={t("paywallUpgrade")}
          returnPath="/fpl/mini-league"
          locale={params.locale}
        />
      ) : profile?.fpl_entry_id || localPreview ? (
        <MiniLeagueApp linkedEntryId={profile?.fpl_entry_id ?? null} />
      ) : (
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <p className="mb-4 text-sm text-muted-foreground">{t("needEntry")}</p>
          <FplEntryLinkForm />
          <p className="mt-4 text-xs text-muted-foreground">
            {t("needEntryHint")}{" "}
            <Link href="/account" className="text-brand-accent hover:underline">
              {t("accountLink")}
            </Link>
          </p>
        </div>
      )}
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "miniLeague",
  });
  return {
    title: t("title"),
    description: t("description"),
  };
}
