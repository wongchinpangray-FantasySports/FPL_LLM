import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsHub } from "@/components/fpl/insights/insights-hub";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { Link } from "@/i18n/navigation";
import { INSIGHT_CATALOG } from "@/lib/fpl/insights/catalog";
import { getInsightsAccessSummary } from "@/lib/fpl/insights/access";
import { getAuthUser } from "@/lib/auth/session";
import { founderPackIsPublic } from "@/lib/billing/founder-pack";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplInsightsHubPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const access = await getInsightsAccessSummary(user?.id);

  return (
    <PageShell
      backHref="/fpl"
      backLabel={t("backFpl")}
      title={t("hubTitle")}
      description={t("hubDescription")}
      width="6xl"
    >
      <div className="flex flex-col gap-5">
        <InsightsSubNav />
        {founderPackIsPublic() ? (
          <Link
            href="/pro"
            className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm text-foreground no-underline hover:bg-amber-500/10"
          >
            {t("founderPackBanner")}
          </Link>
        ) : null}
        <InsightsHub
          entries={INSIGHT_CATALOG}
          featuredId="preseason-signals"
          lockedIds={access.lockedInsightIds}
          enforcePremium={access.enforcePremium}
        />
        {access.enforcePremium ? (
          <p className="text-xs text-muted-foreground">{t("premiumNote")}</p>
        ) : null}
      </div>
    </PageShell>
  );
}
