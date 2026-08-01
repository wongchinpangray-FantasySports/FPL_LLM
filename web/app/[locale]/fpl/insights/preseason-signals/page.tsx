import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { PreseasonSignalsPanel } from "@/components/fpl/insights/preseason-signals-panel";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { loadPreseasonSignals } from "@/lib/fpl/insights/preseason-signals";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function PreseasonSignalsPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const [meta, data] = await Promise.all([loadInsightsMeta(), loadPreseasonSignals()]);

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("preseasonSignals.title")}
      description={t("preseasonSignals.description")}
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
      <PreseasonSignalsPanel
        rows={data.rows}
        matchCount={data.match_count}
        labels={{
          intro: t("preseasonSignals.intro"),
          filterClub: t("preseasonSignals.filterClub"),
          filterAll: t("preseasonSignals.filterAll"),
          colPlayer: t("preseasonSignals.colPlayer"),
          colClub: t("preseasonSignals.colClub"),
          colGoals: t("preseasonSignals.colGoals"),
          colAssists: t("preseasonSignals.colAssists"),
          colStarts: t("preseasonSignals.colStarts"),
          colSubs: t("preseasonSignals.colSubs"),
          colFpl: t("preseasonSignals.colFpl"),
          fplLink: t("preseasonSignals.fplLink"),
          noFpl: t("preseasonSignals.noFpl"),
          empty: t("preseasonSignals.empty"),
          matchNote: t("preseasonSignals.matchNote"),
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
    title: t("preseasonSignals.title"),
    description: t("preseasonSignals.description"),
  };
}
