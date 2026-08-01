import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { XpAccuracyPanel } from "@/components/fpl/insights/xp-accuracy-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { loadXpAccuracy } from "@/lib/fpl/insights/xp-accuracy";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function XpAccuracyPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const [meta, allowed] = await Promise.all([
    loadInsightsMeta(),
    canAccessInsight("xp-accuracy", user?.id),
  ]);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadXpAccuracy() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("xpAccuracy.title")}
      description={t("xpAccuracy.description")}
      width="6xl"
    >
      <InsightsUpdatedBanner
        meta={meta}
        locale={params.locale}
        labels={{
          gwOpen: t("bannerGwOpen"),
          gwClosed: t("bannerGwClosed"),
          synced: t("bannerSynced"),
        }}
      />
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
        <XpAccuracyPanel
          gws={data.gws}
          aggregate={data.aggregate}
          latestGw={data.latest_gw}
          topMisses={data.top_misses}
          labels={{
            intro: t("xpAccuracy.intro"),
            empty: t("xpAccuracy.empty"),
            cardMae: t("xpAccuracy.cardMae"),
            cardRmse: t("xpAccuracy.cardRmse"),
            cardBias: t("xpAccuracy.cardBias"),
            cardCorr: t("xpAccuracy.cardCorr"),
            cardGwCount: t("xpAccuracy.cardGwCount"),
            tabOverview: t("xpAccuracy.tabOverview"),
            tabByGw: t("xpAccuracy.tabByGw"),
            tabMisses: t("xpAccuracy.tabMisses"),
            colGw: t("xpAccuracy.colGw"),
            colCompared: t("xpAccuracy.colCompared"),
            colMae: t("xpAccuracy.colMae"),
            colRmse: t("xpAccuracy.colRmse"),
            colBias: t("xpAccuracy.colBias"),
            colCorr: t("xpAccuracy.colCorr"),
            colMeanPred: t("xpAccuracy.colMeanPred"),
            colMeanAct: t("xpAccuracy.colMeanAct"),
            colPos: t("xpAccuracy.colPos"),
            colPlayer: t("xpAccuracy.colPlayer"),
            colTeam: t("xpAccuracy.colTeam"),
            colPredicted: t("xpAccuracy.colPredicted"),
            colActual: t("xpAccuracy.colActual"),
            colError: t("xpAccuracy.colError"),
            colProfile: t("xpAccuracy.colProfile"),
            profileLink: t("xpAccuracy.profileLink"),
            missesTitle: t("xpAccuracy.missesTitle"),
            positionBreakdown: t("xpAccuracy.positionBreakdown"),
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
    title: t("xpAccuracy.title"),
    description: t("xpAccuracy.description"),
  };
}
