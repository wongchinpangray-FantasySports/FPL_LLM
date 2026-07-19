import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplPreseasonPanel } from "@/components/fpl/fpl-preseason-panel";
import { getPreseasonBundle, groupPreseasonByClub } from "@/lib/fpl/preseason";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplPreseasonPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplHub",
  });
  const bundle = getPreseasonBundle();
  const clubs = groupPreseasonByClub();

  return (
    <PageShell
      backHref="/fpl"
      backLabel={t("preseasonBackFpl")}
      title={t("preseasonPageTitle")}
      description={t("preseasonPageDescription")}
      width="6xl"
    >
      <FplPreseasonPanel
        clubs={clubs}
        locale={params.locale}
        source={bundle.source}
        updatedAt={bundle.updated_at}
        labels={{
          upcoming: t("preseasonUpcoming"),
          results: t("preseasonResults"),
          allClubs: t("preseasonAllClubs"),
          home: t("fixturesHome"),
          away: t("fixturesAway"),
          vs: t("preseasonVs"),
          noMatches: t("preseasonEmpty"),
          sourceNote: t("preseasonSourceNote"),
          expandClub: t("preseasonExpandClub"),
        }}
      />
    </PageShell>
  );
}
