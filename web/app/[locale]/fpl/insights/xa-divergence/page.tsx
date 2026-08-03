import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { XaDivergencePanel } from "@/components/fpl/insights/xa-divergence-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadXaDivergence } from "@/lib/fpl/insights/xa-divergence";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function XaDivergencePage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const allowed = await canAccessInsight("xa-divergence", user?.id);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadXaDivergence() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("xaDivergence.title")}
      description={t("xaDivergence.description")}
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
        <XaDivergencePanel
          rows={data.rows}
          minMinutes={data.minMinutes}
          labels={{
            intro: t("xaDivergence.intro"),
            filterPos: t("xaDivergence.filterPos"),
            posAll: t("xaDivergence.posAll"),
            posDef: t("xaDivergence.posDef"),
            posMid: t("xaDivergence.posMid"),
            posFwd: t("xaDivergence.posFwd"),
            minMinutes: t("xaDivergence.minMinutes"),
            colPlayer: t("xaDivergence.colPlayer"),
            colTeam: t("xaDivergence.colTeam"),
            colPos: t("xaDivergence.colPos"),
            colMins: t("xaDivergence.colMins"),
            colAssists: t("xaDivergence.colAssists"),
            colFplXa: t("xaDivergence.colFplXa"),
            colUsXa: t("xaDivergence.colUsXa"),
            colFplDelta: t("xaDivergence.colFplDelta"),
            colUsDelta: t("xaDivergence.colUsDelta"),
            colFplUs: t("xaDivergence.colFplUs"),
            colProfile: t("xaDivergence.colProfile"),
            profileLink: t("xaDivergence.profileLink"),
            empty: t("xaDivergence.empty"),
            deltaHint: t("xaDivergence.deltaHint"),
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
    title: t("xaDivergence.title"),
    description: t("xaDivergence.description"),
  };
}
