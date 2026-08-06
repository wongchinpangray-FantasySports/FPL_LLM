import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { ValueBandPanel } from "@/components/fpl/insights/value-band-panel";
import { loadMid50ValueBandCached } from "@/lib/fpl/insights/value-bands";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function Mid50ValueBandPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({
    locale: params.locale,
    namespace: "fplInsights",
  });
  const data = await loadMid50ValueBandCached();

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("valueMid50.title")}
      description={t("valueMid50.description")}
      width="6xl"
    >
      <InsightsSubNav />
      <ValueBandPanel
        rows={data.rows}
        takeaways={data.takeaways}
        assessed={data.assessed}
        horizon={data.horizon}
        locale={params.locale}
        labels={{
          intro: t("valueMid50.intro", {
            n: data.assessed,
            horizon: data.horizon,
          }),
          takeawaysTitle: t("valueMid50.takeawaysTitle"),
          assessed: t("valueMid50.assessed", { n: data.assessed }),
          colPlayer: t("valueMid50.colPlayer"),
          colTeam: t("valueMid50.colTeam"),
          colPrice: t("valueMid50.colPrice"),
          colOwn: t("valueMid50.colOwn"),
          colXp: t("valueMid50.colXp"),
          colMins: t("valueMid50.colMins"),
          colThreat: t("valueMid50.colThreat"),
          colDefcon90: t("valueMid50.colDefcon90"),
          colPreG: t("valueMid50.colPreG"),
          colValue: t("valueMid50.colValue"),
          colProfile: t("valueMid50.colProfile"),
          profileLink: t("valueMid50.profileLink"),
          empty: t("valueMid50.empty"),
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
    title: t("valueMid50.title"),
    description: t("valueMid50.description"),
  };
}
