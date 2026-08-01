import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { FixtureSwingPanel } from "@/components/fpl/insights/fixture-swing-panel";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { loadFixtureSwing } from "@/lib/fpl/insights/fixture-swing";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FixtureSwingPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const [meta, data] = await Promise.all([loadInsightsMeta(), loadFixtureSwing()]);

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("fixtureSwing.title")}
      description={t("fixtureSwing.description")}
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
      <FixtureSwingPanel
        rows={data.rows}
        fromGw={data.fromGw}
        defaultHorizon={data.horizon}
        labels={{
          intro: t("fixtureSwing.intro"),
          horizon: t("fixtureSwing.horizon"),
          horizon5: t("fixtureSwing.horizon5"),
          horizon8: t("fixtureSwing.horizon8"),
          colTeam: t("fixtureSwing.colTeam"),
          colAvgFdr: t("fixtureSwing.colAvgFdr"),
          colFixtures: t("fixtureSwing.colFixtures"),
          empty: t("fixtureSwing.empty"),
          fdrLegend: {
            1: t("fixtureSwing.fdr1"),
            2: t("fixtureSwing.fdr2"),
            3: t("fixtureSwing.fdr3"),
            4: t("fixtureSwing.fdr4"),
            5: t("fixtureSwing.fdr5"),
          },
          home: t("fixtureSwing.home"),
          away: t("fixtureSwing.away"),
        }}
      />
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  return {
    title: t("fixtureSwing.title"),
    description: t("fixtureSwing.description"),
  };
}
