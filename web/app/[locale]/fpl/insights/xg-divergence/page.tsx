import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { XgDivergencePanel } from "@/components/fpl/insights/xg-divergence-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { loadXgDivergence } from "@/lib/fpl/insights/xg-divergence";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function XgDivergencePage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const [meta, allowed] = await Promise.all([
    loadInsightsMeta(),
    canAccessInsight("xg-divergence", user?.id),
  ]);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadXgDivergence() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("xgDivergence.title")}
      description={t("xgDivergence.description")}
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
        <XgDivergencePanel
          rows={data.rows}
          minMinutes={data.minMinutes}
          labels={{
            intro: t("xgDivergence.intro"),
            filterPos: t("xgDivergence.filterPos"),
            posAll: t("xgDivergence.posAll"),
            posDef: t("xgDivergence.posDef"),
            posMid: t("xgDivergence.posMid"),
            posFwd: t("xgDivergence.posFwd"),
            minMinutes: t("xgDivergence.minMinutes"),
            sortBy: t("xgDivergence.sortBy"),
            sortFplUnder: t("xgDivergence.sortFplUnder"),
            sortFplOver: t("xgDivergence.sortFplOver"),
            sortUsUnder: t("xgDivergence.sortUsUnder"),
            sortFplVsUs: t("xgDivergence.sortFplVsUs"),
            colPlayer: t("xgDivergence.colPlayer"),
            colTeam: t("xgDivergence.colTeam"),
            colPos: t("xgDivergence.colPos"),
            colMins: t("xgDivergence.colMins"),
            colGoals: t("xgDivergence.colGoals"),
            colFplXg: t("xgDivergence.colFplXg"),
            colUsXg: t("xgDivergence.colUsXg"),
            colFplDelta: t("xgDivergence.colFplDelta"),
            colUsDelta: t("xgDivergence.colUsDelta"),
            colFplUs: t("xgDivergence.colFplUs"),
            colProfile: t("xgDivergence.colProfile"),
            profileLink: t("xgDivergence.profileLink"),
            empty: t("xgDivergence.empty"),
            deltaHint: t("xgDivergence.deltaHint"),
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
    title: t("xgDivergence.title"),
    description: t("xgDivergence.description"),
  };
}
