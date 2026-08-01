import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { InsightsPlaceholder } from "@/components/fpl/insights/insights-placeholder";
import { InsightsPaywall } from "@/components/fpl/insights/insights-paywall";
import { InsightsSponsorBanner } from "@/components/fpl/insights/insights-sponsor-banner";
import { getInsightById } from "@/lib/fpl/insights/catalog";
import {
  canAccessInsight,
  getInsightsSponsor,
  isInsightsPremiumEnforced,
} from "@/lib/fpl/insights/access";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string; slug: string } };

const PLACEHOLDER_SLUGS = new Set([
  "set-pieces",
  "defcon",
  "transfers",
  "differentials",
  "fixture-swing",
  "xg-divergence",
  "price-changes",
  "xp-accuracy",
]);

export default async function InsightSlugPage({ params }: Props) {
  if (!PLACEHOLDER_SLUGS.has(params.slug)) notFound();

  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const entry = getInsightById(params.slug);
  if (!entry) notFound();

  const user = await getAuthUser();
  const [meta, allowed] = await Promise.all([
    loadInsightsMeta(),
    canAccessInsight(entry.id, user?.id),
  ]);
  const sponsor = getInsightsSponsor();
  const title = t(entry.titleKey as Parameters<typeof t>[0]);
  const description = t(entry.descriptionKey as Parameters<typeof t>[0]);

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={title}
      description={description}
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
      {entry.tier === "premium" && sponsor ? (
        <InsightsSponsorBanner
          sponsorName={sponsor.name}
          sponsorHref={sponsor.href}
          disclosure={t("sponsorDisclosure")}
        />
      ) : null}
      {!allowed && isInsightsPremiumEnforced() ? (
        <InsightsPaywall
          title={t("paywallTitle")}
          body={t("paywallBody")}
          signInLabel={t("paywallSignIn")}
          upgradeLabel={t("paywallUpgrade")}
        />
      ) : (
        <InsightsPlaceholder
          title={title}
          description={t("comingSoonBody", { phase: entry.phase })}
          phaseLabel={t("comingSoonLabel")}
          backHref="/fpl/insights"
          backLabel={t("backInsights")}
        />
      )}
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const entry = getInsightById(params.slug);
  if (!entry) return {};
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  return {
    title: t(entry.titleKey as Parameters<typeof t>[0]),
    description: t(entry.descriptionKey as Parameters<typeof t>[0]),
  };
}
