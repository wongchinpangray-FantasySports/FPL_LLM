import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplDailyPanel } from "@/components/news/fpl-daily-panel";

type Props = {
  params: { locale: string };
};

export default async function FplDailyNewsPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "newsIndex" });
  const common = await getTranslations({ locale: params.locale, namespace: "common" });

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("fplDailyTitle")} description={t("fplDailySummary")} width="6xl">
      <FplDailyPanel
        locale={params.locale}
        labels={{
          loading: t("fplDailyLoading"),
          empty: t("fplDailyEmpty"),
          windowLabel: t("fplDailyWindow"),
          sourcesTitle: t("fplDailySources"),
          generatedAt: t("fplDailyGenerated"),
          disclaimer: t("fplDailyDisclaimer"),
          archiveLink: t("fplDailyArchiveLink"),
        }}
      />
    </PageShell>
  );
}
