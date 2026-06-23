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
    Promise.resolve(buildFplFixtureGrid()),
    buildH2HHistoryLookup(),
  ]);
  const seasonLabel = `${grid.fplSeason}/${String(Number(grid.fplSeason) + 1).slice(-2)}`;

  return (
    <PageShell
      backHref="/fpl"
      backLabel={t("fixturesBackFpl")}
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
          labels={{
            team: t("fixtureTableTeam"),
            expandHint: t("fixturesExpandHint"),
            gwLabel: t("fixturesGwLabel"),
            dgw: t("fixturesDgw"),
            home: t("fixturesHome"),
            away: t("fixturesAway"),
            h2hTitle: t("fixturesH2hTitle"),
            h2hEmpty: t("fixturesH2hEmpty"),
            h2hTapHint: t("fixturesH2hTapHint"),
            close: t("fixturesH2hClose"),
          }}
        />
      ) : null}
    </PageShell>
  );
}
