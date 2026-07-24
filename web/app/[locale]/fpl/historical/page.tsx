import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplHistoricalData } from "@/components/fpl/fpl-historical-data";
import { loadHistoricalMeta } from "@/lib/fpl/historical-data";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplHistoricalPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplHistorical",
  });
  const common = await getTranslations({
    locale: params.locale,
    namespace: "common",
  });

  let meta;
  try {
    meta = await loadHistoricalMeta();
  } catch {
    meta = null;
  }

  const labels = {
    season: t("season"),
    seasonAll: t("seasonAll"),
    gwFrom: t("gwFrom"),
    gwTo: t("gwTo"),
    position: t("position"),
    positionAll: t("positionAll"),
    team: t("team"),
    teamAll: t("teamAll"),
    name: t("name"),
    namePlaceholder: t("namePlaceholder"),
    nameHint: t("nameHint"),
    nameSearching: t("nameSearching"),
    nameNoSuggestions: t("nameNoSuggestions"),
    nameSeasons: t("nameSeasons"),
    minMinutes: t("minMinutes"),
    minAppearances: t("minAppearances"),
    sortBy: t("sortBy"),
    sortDir: t("sortDir"),
    sortAsc: t("sortAsc"),
    sortDesc: t("sortDesc"),
    apply: t("apply"),
    reset: t("reset"),
    loading: t("loading"),
    noResults: t("noResults"),
    results: t("results"),
    showing: t("showing"),
    prev: t("prev"),
    next: t("next"),
    openProfile: t("openProfile"),
    colPlayer: t("colPlayer"),
    colSeason: t("colSeason"),
    colTeam: t("colTeam"),
    colPos: t("colPos"),
    colApps: t("colApps"),
    colMins: t("colMins"),
    colPts: t("colPts"),
    colGoals: t("colGoals"),
    colAssists: t("colAssists"),
    colCs: t("colCs"),
    colXg: t("colXg"),
    colXa: t("colXa"),
    colIct: t("colIct"),
    colPts90: t("colPts90"),
    colXgi90: t("colXgi90"),
    sortTotalPoints: t("sortTotalPoints"),
    sortGoals: t("sortGoals"),
    sortAssists: t("sortAssists"),
    sortXg: t("sortXg"),
    sortXa: t("sortXa"),
    sortCs: t("sortCs"),
    sortMinutes: t("sortMinutes"),
    sortBonus: t("sortBonus"),
    sortIct: t("sortIct"),
    sortBps: t("sortBps"),
    sortDefcon: t("sortDefcon"),
    sortPts90: t("sortPts90"),
    sortApps: t("sortApps"),
    detailClose: t("detailClose"),
    detailLoading: t("detailLoading"),
    detailError: t("detailError"),
    detailSeasonRange: t("detailSeasonRange"),
    detailSummaryTitle: t("detailSummaryTitle"),
    detailGwBreakdownTitle: t("detailGwBreakdownTitle"),
    detailNoGameweeks: t("detailNoGameweeks"),
    detailViewCurrentProfile: t("detailViewCurrentProfile"),
    detailColGw: t("detailColGw"),
    detailColBps: t("detailColBps"),
    detailColDefcon: t("detailColDefcon"),
    detailColOpponent: t("detailColOpponent"),
    detailDgw: t("detailDgw"),
    detailBgw: t("detailBgw"),
  };

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      eyebrow={t("eyebrow")}
      title={t("title")}
      width="6xl"
    >
      <FplHistoricalData meta={meta} labels={labels} />
    </PageShell>
  );
}
