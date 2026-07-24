import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplXPanel } from "@/components/news/fpl-x-panel";

type Props = {
  params: { locale: string };
};

export default async function FplXNewsPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "newsIndex" });
  const common = await getTranslations({ locale: params.locale, namespace: "common" });
  const tWc = await getTranslations({ locale: params.locale, namespace: "worldcup" });

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("fplXTitle")} description={t("fplXSummary")} width="6xl">
      <FplXPanel
        locale={params.locale}
        labels={{
          loading: tWc("loading"),
          empty: t("fplXEmpty"),
          windowLabel: t("fplDailyWindow"),
          sourcesTitle: t("fplDailySources"),
          generatedAt: t("fplDailyGenerated"),
          todayNote: t("fplXTodayNote"),
          seeDaily: t("navFplDaily"),
          disclaimer: t("fplDailyDisclaimer"),
          openOnX: t("fplXOpenOnX"),
        }}
      />
    </PageShell>
  );
}
