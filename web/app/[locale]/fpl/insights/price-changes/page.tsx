import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { PriceChangesPanel } from "@/components/fpl/insights/price-changes-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadPriceChanges } from "@/lib/fpl/insights/price-changes";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PriceChangesPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const allowed = await canAccessInsight("price-changes", user?.id);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadPriceChanges() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("priceChanges.title")}
      description={t("priceChanges.description")}
      width="6xl"
    >
      <InsightsSubNav />
      {sponsor ? (
        <InsightsSponsorBanner
          sponsorName={sponsor.name}
          sponsorHref={sponsor.href}
          disclosure={t("sponsorDisclosure")}
        />
      ) : null}
      {!allowed && enforce ? (
        <InsightsPaywall
          title={t("paywallTitle")}
          body={t("paywallBody")}
          signInLabel={t("paywallSignIn")}
          upgradeLabel={t("paywallUpgrade")}
        />
      ) : data ? (
        <PriceChangesPanel
          rows={data.rows}
          gw={data.gw}
          labels={{
            intro: t("priceChanges.intro", { gw: data.gw }),
            tabRecent: t("priceChanges.tabRecent"),
            tabRisers: t("priceChanges.tabRisers"),
            tabFallers: t("priceChanges.tabFallers"),
            tabVolatile: t("priceChanges.tabVolatile"),
            filterPos: t("priceChanges.filterPos"),
            posAll: t("priceChanges.posAll"),
            posGkp: t("priceChanges.posGkp"),
            posDef: t("priceChanges.posDef"),
            posMid: t("priceChanges.posMid"),
            posFwd: t("priceChanges.posFwd"),
            colPlayer: t("priceChanges.colPlayer"),
            colTeam: t("priceChanges.colTeam"),
            colPos: t("priceChanges.colPos"),
            colPrice: t("priceChanges.colPrice"),
            colNet: t("priceChanges.colNet"),
            colChanges: t("priceChanges.colChanges"),
            colLastGw: t("priceChanges.colLastGw"),
            colLastDelta: t("priceChanges.colLastDelta"),
            colRecent: t("priceChanges.colRecent"),
            colProfile: t("priceChanges.colProfile"),
            profileLink: t("priceChanges.profileLink"),
            empty: t("priceChanges.empty"),
          }}
        />
      ) : null}
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  return {
    title: t("priceChanges.title"),
    description: t("priceChanges.description"),
  };
}
