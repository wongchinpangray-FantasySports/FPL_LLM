import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { PriceForecastPanel } from "@/components/fpl/insights/price-forecast-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import {
  loadPriceForecast,
  tableRowsForTab,
} from "@/lib/fpl/insights/price-forecast";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PriceForecastPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const allowed = await canAccessInsight("price-forecast", user?.id);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadPriceForecast() : null;
  const tableRows = data ? tableRowsForTab(data, "all") : [];

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("priceForecast.title")}
      description={t("priceForecast.description")}
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
        <PriceForecastPanel
          rows={tableRows}
          gw={data.gw}
          source={data.source}
          likelyRiseCount={data.likely_rise.length}
          likelyFallCount={data.likely_fall.length}
          labels={{
            intro: t("priceForecast.intro", { gw: data.gw }),
            sourceLive: t("priceForecast.sourceLive"),
            sourceDb: t("priceForecast.sourceDb"),
            summaryRise: t("priceForecast.summaryRise"),
            summaryFall: t("priceForecast.summaryFall"),
            tabLikely: t("priceForecast.tabLikely"),
            tabRise: t("priceForecast.tabRise"),
            tabFall: t("priceForecast.tabFall"),
            tabAll: t("priceForecast.tabAll"),
            filterPos: t("priceForecast.filterPos"),
            posAll: t("priceForecast.posAll"),
            posGkp: t("priceForecast.posGkp"),
            posDef: t("priceForecast.posDef"),
            posMid: t("priceForecast.posMid"),
            posFwd: t("priceForecast.posFwd"),
            colPlayer: t("priceForecast.colPlayer"),
            colTeam: t("priceForecast.colTeam"),
            colPos: t("priceForecast.colPos"),
            colPrice: t("priceForecast.colPrice"),
            colOwn: t("priceForecast.colOwn"),
            colNet: t("priceForecast.colNet"),
            colProgress: t("priceForecast.colProgress"),
            colStatus: t("priceForecast.colStatus"),
            colProfile: t("priceForecast.colProfile"),
            profileLink: t("priceForecast.profileLink"),
            statusLikelyRise: t("priceForecast.statusLikelyRise"),
            statusWatchRise: t("priceForecast.statusWatchRise"),
            statusLikelyFall: t("priceForecast.statusLikelyFall"),
            statusWatchFall: t("priceForecast.statusWatchFall"),
            statusStable: t("priceForecast.statusStable"),
            alreadyUp: t("priceForecast.alreadyUp"),
            alreadyDown: t("priceForecast.alreadyDown"),
            empty: t("priceForecast.empty"),
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
    title: t("priceForecast.title"),
    description: t("priceForecast.description"),
  };
}
