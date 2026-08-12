import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { RecommendedSquadPanel } from "@/components/fpl/insights/recommended-squad-panel";
import { RequireAuthGate } from "@/components/auth/require-auth-gate";
import { loadExcludeChipPlayers } from "@/lib/fpl/recommended-squad";
import { getAuthUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function RecommendedSquadPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });

  const user = await getAuthUser();
  let excludePlayers: Awaited<ReturnType<typeof loadExcludeChipPlayers>> = [];
  if (user) {
    try {
      excludePlayers = await loadExcludeChipPlayers(12);
    } catch {
      excludePlayers = [];
    }
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
      <RequireAuthGate
        titleKey="recommendedSquadTitle"
        bodyKey="recommendedSquadBody"
        loadingKey="recommendedSquadLoading"
        hintKey="recommendedSquadSignInHint"
      >
        <RecommendedSquadPanel excludePlayers={excludePlayers} />
      </RequireAuthGate>
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
