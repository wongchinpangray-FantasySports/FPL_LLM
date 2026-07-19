import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplPreseasonPanel } from "@/components/fpl/fpl-preseason-panel";
import { groupPreseasonByClub, loadPreseasonBundle } from "@/lib/fpl/preseason";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function FplPreseasonPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplHub",
  });
  const bundle = await loadPreseasonBundle();
  const clubs = groupPreseasonByClub(bundle.matches);

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
          vs: t("preseasonVs"),
          noMatches: t("preseasonEmpty"),
          sourceNote: t("preseasonSourceNote"),
          expandClub: t("preseasonExpandClub"),
          tickerUpcoming: t("preseasonTickerUpcoming"),
          tickerResult: t("preseasonTickerResult"),
          kickoffBeijing: t("preseasonKickoffBeijing"),
          kickoffTbd: t("preseasonKickoffTbd"),
          assist: t("preseasonAssist"),
          noGoalDetails: t("preseasonNoGoalDetails"),
        }}
      />
    </PageShell>
  );
}
