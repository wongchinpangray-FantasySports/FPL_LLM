import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { InsightsSubNav } from "@/components/fpl/insights/insights-sub-nav";
import { DefconPanel } from "@/components/fpl/insights/defcon-panel";
import { loadDefconLeaders } from "@/lib/fpl/insights/defcon";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

export default async function DefconPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "fplInsights" });
  const data = await loadDefconLeaders();

  return (
    <PageShell
      backHref="/fpl/insights"
      backLabel={t("backInsights")}
      title={t("defcon.title")}
      description={t("defcon.description")}
      width="6xl"
    >
      <InsightsSubNav />
      <DefconPanel
        rows={data.rows}
        labels={{
          intro: t("defcon.intro"),
          filterPos: t("defcon.filterPos"),
          posAll: t("defcon.posAll"),
          posGkp: t("defcon.posGkp"),
          posDef: t("defcon.posDef"),
          posMid: t("defcon.posMid"),
          posFwd: t("defcon.posFwd"),
          minMinutes: t("defcon.minMinutes"),
          colPlayer: t("defcon.colPlayer"),
          colTeam: t("defcon.colTeam"),
          colPos: t("defcon.colPos"),
          colDefcon: t("defcon.colDefcon"),
          colDefcon90: t("defcon.colDefcon90"),
          colCbi: t("defcon.colCbi"),
          colRec: t("defcon.colRec"),
          colTkl: t("defcon.colTkl"),
          colMins: t("defcon.colMins"),
          colProfile: t("defcon.colProfile"),
          profileLink: t("defcon.profileLink"),
          empty: t("defcon.empty"),
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
    title: t("defcon.title"),
    description: t("defcon.description"),
  };
}
