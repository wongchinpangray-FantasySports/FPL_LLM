import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { TransfersPanel } from "@/components/fpl/insights/transfers-panel";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadTransferMomentum } from "@/lib/fpl/insights/transfers";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function TransfersInsightPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const user = await getAuthUser();
  const allowed = await canAccessInsight("transfers", user?.id);
  const sponsor = getInsightsSponsor();
  const enforce = isInsightsPremiumEnforced();
  const data = allowed || !enforce ? await loadTransferMomentum() : null;

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("transfers.title")}
      description={t("transfers.description")}
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
        <TransfersPanel
          rows={data.rows}
          gw={data.gw}
          labels={{
            intro: t("transfers.intro"),
            tabNet: t("transfers.tabNet"),
            tabIn: t("transfers.tabIn"),
            tabOut: t("transfers.tabOut"),
            tabOwnership: t("transfers.tabOwnership"),
            filterPos: t("transfers.filterPos"),
            posAll: t("transfers.posAll"),
            posGkp: t("transfers.posGkp"),
            posDef: t("transfers.posDef"),
            posMid: t("transfers.posMid"),
            posFwd: t("transfers.posFwd"),
            colPlayer: t("transfers.colPlayer"),
            colTeam: t("transfers.colTeam"),
            colPos: t("transfers.colPos"),
            colPrice: t("transfers.colPrice"),
            colOwn: t("transfers.colOwn"),
            colOwnDelta: t("transfers.colOwnDelta"),
            colIn: t("transfers.colIn"),
            colOut: t("transfers.colOut"),
            colNet: t("transfers.colNet"),
            colProfile: t("transfers.colProfile"),
            profileLink: t("transfers.profileLink"),
            empty: t("transfers.empty"),
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
    title: t("transfers.title"),
    description: t("transfers.description"),
  };
}
