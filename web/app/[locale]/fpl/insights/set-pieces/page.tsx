import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { SetPiecesPanel } from "@/components/fpl/insights/set-pieces-panel";
import { loadSetPieces } from "@/lib/fpl/insights/set-pieces";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function SetPiecesPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const data = await loadSetPieces();

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("setPieces.title")}
      description={t("setPieces.description")}
      width="6xl"
    >
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
          colXg90: t("setPieces.colXg90"),
          colXa90: t("setPieces.colXa90"),
          colProfile: t("setPieces.colProfile"),
          profileLink: t("setPieces.profileLink"),
          empty: t("setPieces.empty"),
          primaryOnly: t("setPieces.primaryOnly"),
          showAll: t("setPieces.showAll"),
          rolePrimary: t("setPieces.rolePrimary"),
          roleBackup: t("setPieces.roleBackup"),
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
