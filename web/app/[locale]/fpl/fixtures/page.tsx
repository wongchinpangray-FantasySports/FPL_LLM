import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplFixturesGrid } from "@/components/fpl/fpl-fixtures-grid";
import { buildFplFixtureGrid } from "@/lib/fpl/fixtures-grid";
import { buildH2HHistoryLookup } from "@/lib/fpl/h2h-history";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplFixturesPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplHub" });
  const [grid, h2hHistory] = await Promise.all([
    buildFplFixtureGrid(),
    buildH2HHistoryLookup(),
  ]);
  const seasonLabel = `${grid.fplSeason}/${String(Number(grid.fplSeason) + 1).slice(-2)}`;

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      title={t("fixturesPageTitle", { season: seasonLabel })}
      description={t("fixturesPageDescription")}
      width="6xl"
    >
      {grid.rows.length > 0 ? (
        <FplFixturesGrid
          rows={grid.rows}
          gwBlocks={grid.gwBlocks}
          dgwKeys={grid.dgwKeys}
          h2hHistory={h2hHistory}
          title={t("fixturesTitle", { season: seasonLabel })}
          summary={t("fixturesEyebrow")}
          hint={t("fixturesHint")}
          fdrLegend={{
            1: t("fdrLegend1"),
            2: t("fdrLegend2"),
            3: t("fdrLegend3"),
            4: t("fdrLegend4"),
            5: t("fdrLegend5"),
          }}
          labels={{
            team: t("fixtureTableTeam"),
            expandHint: t("fixturesExpandHint"),
            gwLabel: t("fixturesGwLabel"),
            dgw: t("fixturesDgw"),
            home: t("fixturesHome"),
            away: t("fixturesAway"),
            h2hTitleHome: t("fixturesH2hTitleHome"),
            h2hTitleAway: t("fixturesH2hTitleAway"),
            h2hEmptyHome: t("fixturesH2hEmptyHome"),
            h2hEmptyAway: t("fixturesH2hEmptyAway"),
            h2hTapHint: t("fixturesH2hTapHint"),
            close: t("fixturesH2hClose"),
          }}
        />
      ) : null}
    </PageShell>
  );
}
