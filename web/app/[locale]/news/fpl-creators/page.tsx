import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { NewsSubNav } from "@/components/news/news-sub-nav";
import { FplCreatorsPanel } from "@/components/news/fpl-creators-panel";

type Props = {
  params: { locale: string };
};

export default async function FplCreatorsNewsPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "newsIndex" });
  const common = await getTranslations({ locale: params.locale, namespace: "common" });
  const tWc = await getTranslations({ locale: params.locale, namespace: "worldcup" });

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      title={t("fplCreatorsTitle")}
      description={t("fplCreatorsSummary")}
      width="6xl"
    >
      <div className="flex flex-col gap-4">
        <NewsSubNav />
        <FplCreatorsPanel
          locale={params.locale}
          labels={{
            loading: tWc("loading"),
            empty: t("fplCreatorsEmpty"),
            refresh: tWc("newsRefresh"),
            filterAll: t("fplCreatorsFilterAll"),
            readMore: tWc("newsReadMore"),
            kindArticle: t("fplCreatorsKindArticle"),
            kindYoutube: t("fplCreatorsKindYoutube"),
            kindPodcast: t("fplCreatorsKindPodcast"),
            disclaimer: t("fplCreatorsDisclaimer"),
          }}
        />
      </div>
    </PageShell>
  );
}
