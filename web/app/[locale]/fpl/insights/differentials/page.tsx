import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { DifferentialsPanel } from "@/components/fpl/insights/differentials-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadDifferentials } from "@/lib/fpl/insights/differentials";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function DifferentialsInsightPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const allowed = await canAccessInsight("differentials", user?.id);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadDifferentials() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("differentials.title")}
      description={t("differentials.description")}
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
        <DifferentialsPanel
          rows={data.rows}
          horizon={data.horizon}
          maxOwnership={data.maxOwnership}
          labels={{
            intro: t("differentials.intro"),
            filterPos: t("differentials.filterPos"),
            posAll: t("differentials.posAll"),
            posGkp: t("differentials.posGkp"),
            posDef: t("differentials.posDef"),
            posMid: t("differentials.posMid"),
            posFwd: t("differentials.posFwd"),
            colPlayer: t("differentials.colPlayer"),
            colTeam: t("differentials.colTeam"),
            colPos: t("differentials.colPos"),
            colPrice: t("differentials.colPrice"),
            colOwn: t("differentials.colOwn"),
            colForm: t("differentials.colForm"),
            colXp: t("differentials.colXp"),
            colXpGw: t("differentials.colXpGw"),
            colValue: t("differentials.colValue"),
            colFixtures: t("differentials.colFixtures"),
            colProfile: t("differentials.colProfile"),
            profileLink: t("differentials.profileLink"),
            empty: t("differentials.empty"),
            fixtureHome: t("differentials.fixtureChip"),
            fixtureAway: t("differentials.fixtureChip"),
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
    title: t("differentials.title"),
    description: t("differentials.description"),
  };
}
