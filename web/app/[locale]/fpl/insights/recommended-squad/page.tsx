import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { RecommendedSquadPanel } from "@/components/fpl/insights/recommended-squad-panel";
import { loadExcludeChipPlayers } from "@/lib/fpl/recommended-squad";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function RecommendedSquadPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });

  let excludePlayers: Awaited<ReturnType<typeof loadExcludeChipPlayers>> = [];
  try {
    excludePlayers = await loadExcludeChipPlayers(12);
  } catch {
    excludePlayers = [];
  }

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("recommendedSquad.title")}
      description={t("recommendedSquad.description")}
      width="6xl"
    >
      <InsightsSubNav />
      <RecommendedSquadPanel excludePlayers={excludePlayers} />
    </PageShell>
  );
}

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  return {
    title: t("recommendedSquad.title"),
    description: t("recommendedSquad.description"),
  };
}
