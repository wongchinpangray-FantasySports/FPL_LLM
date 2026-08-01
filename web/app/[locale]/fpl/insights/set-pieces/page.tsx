import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { InsightsUpdatedBanner } from "@/components/fpl/insights/insights-updated-banner";
import { SetPiecesPanel } from "@/components/fpl/insights/set-pieces-panel";
import { loadInsightsMeta } from "@/lib/fpl/insights/meta";
import { loadSetPieces } from "@/lib/fpl/insights/set-pieces";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SetPiecesPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const [meta, data] = await Promise.all([loadInsightsMeta(), loadSetPieces()]);

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("setPieces.title")}
      description={t("setPieces.description")}
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
      <SetPiecesPanel
        teams={data.teams}
        labels={{
          intro: t("setPieces.intro"),
          filterTeam: t("setPieces.filterTeam"),
          filterAll: t("setPieces.filterAll"),
          colPlayer: t("setPieces.colPlayer"),
          colPos: t("setPieces.colPos"),
          colPen: t("setPieces.colPen"),
          colFk: t("setPieces.colFk"),
          colCorners: t("setPieces.colCorners"),
          colProfile: t("setPieces.colProfile"),
          profileLink: t("setPieces.profileLink"),
          empty: t("setPieces.empty"),
          primaryOnly: t("setPieces.primaryOnly"),
          showAll: t("setPieces.showAll"),
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
    title: t("setPieces.title"),
    description: t("setPieces.description"),
  };
}
