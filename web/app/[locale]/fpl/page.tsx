import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplHub } from "@/components/fpl/fpl-hub";
import { FplFdrGrid } from "@/components/fpl/fpl-fdr-grid";
import { buildFplFixtureGrid } from "@/lib/fpl/fixtures-grid";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplHub" });
  const grid = await buildFplFixtureGrid();
  const seasonLabel = `${grid.fplSeason}/${String(Number(grid.fplSeason) + 1).slice(-2)}`;

  return (
    <PageShell
      backHref="/"
      backLabel={t("backHome")}
      title={t("title")}
      description={t("description")}
      width="6xl"
    >
      <div className="flex flex-col gap-8">
        <FplHub />
        {grid.rows.length > 0 ? (
          <FplFdrGrid
            rows={grid.rows}
            gwBlocks={grid.gwBlocks}
            dgwKeys={grid.dgwKeys}
            title={t("fixturesTitle", { season: seasonLabel })}
            summary={t("fixturesEyebrow")}
            detail={t("fixturesDetail")}
            moreLabel={t("fixturesMore")}
            hint={t("fixturesHint")}
            labels={{
              team: t("fixtureTableTeam"),
              expandHint: t("fixturesExpandHint"),
              gwLabel: t("fixturesGwLabel"),
              dgw: t("fixturesDgw"),
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
