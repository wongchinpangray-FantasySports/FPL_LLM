import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { PlayersExplorer } from "@/components/player/players-explorer";
import { loadPlayersExplorerCached } from "@/lib/fpl/players-explorer";

export const dynamic = "force-dynamic";

export default async function PlayersSearchPage({
  params,
}: {
  params: { locale: string };
}) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "playersIndex" });
  const data = await loadPlayersExplorerCached(5);

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <PlayersExplorer
        rows={data.rows}
        teams={data.teams}
        horizon={data.horizon}
        fromGw={data.from_gw}
        toGw={data.to_gw}
        assessed={data.assessed}
      />
    </PageShell>
  );
}
