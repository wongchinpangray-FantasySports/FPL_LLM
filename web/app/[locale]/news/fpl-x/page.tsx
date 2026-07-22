import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { FplXPanel } from "@/components/news/fpl-x-panel";

type Props = {
  params: { locale: string };
};

export default async function FplXNewsPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "newsIndex" });
  const tWc = await getTranslations({ locale: params.locale, namespace: "worldcup" });

  return (
    <PageShell title={t("fplXTitle")} description={t("fplXSummary")} width="6xl">
      <FplXPanel
        locale={params.locale}
        labels={{
          readMore: tWc("newsReadMore"),
          loading: tWc("loading"),
          empty: t("fplXEmpty"),
          refresh: tWc("newsRefresh"),
          count: tWc("newsCount"),
          updating: tWc("newsUpdating"),
          openOnX: t("fplXOpenOnX"),
          topics: {
            all: t("fplXTopicAll"),
            injury: t("fplXTopicInjury"),
            lineup: t("fplXTopicLineup"),
            transfer: t("fplXTopicTransfer"),
          },
        }}
      />
    </PageShell>
  );
}
