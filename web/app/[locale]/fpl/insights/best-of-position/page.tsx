import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { BestOfPositionHub } from "@/components/fpl/insights/best-of-position-hub";
import { BestOfPositionSeriesNav } from "@/components/fpl/insights/best-of-position-series-nav";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function BestOfPositionHubPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("bestOfPosition.title")}
      description={t("bestOfPosition.description")}
      width="6xl"
    >
      <InsightsSubNav />
      <div className="mt-4 flex flex-col gap-5">
        <BestOfPositionSeriesNav />
        <BestOfPositionHub />
      </div>
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  return {
    title: t("bestOfPosition.title"),
    description: t("bestOfPosition.description"),
  };
}
