"use client";

import { useLocale, useTranslations } from "next-intl";
import type { NewsCategory } from "@/lib/wc/news-feeds";
import { WcNewsPanel } from "@/components/worldcup/wc-news-panel";
import { NewsSubNav } from "@/components/news/news-sub-nav";

export function NewsPageContent({ defaultCategory = "trending" }: { defaultCategory?: NewsCategory }) {
  const locale = useLocale();
  const t = useTranslations("worldcup");
  const tIndex = useTranslations("newsIndex");

  return (
    <div className="flex flex-col gap-4">
      <NewsSubNav />
      <WcNewsPanel
      locale={locale}
      title=""
      summary=""
      detail={t("newsDetail")}
      moreLabel={t("moreDetail")}
      defaultCategory={defaultCategory}
      labels={{
        filterRegion: t("newsFilterRegion"),
        regionAll: t("newsRegionAll"),
        editorialOnly: t("newsEditorialOnly"),
        editorialBadge: t("newsEditorialBadge"),
        readMore: t("newsReadMore"),
        loading: t("loading"),
        empty: t("newsEmpty"),
        refresh: t("newsRefresh"),
        count: t("newsCount"),
        savedOnDevice: t("newsSavedOnDevice"),
        updating: t("newsUpdating"),
        regions: {
          US: t("newsRegionUs"),
          UK: t("newsRegionUk"),
          EU: t("newsRegionEu"),
          LATAM: t("newsRegionLatam"),
          APAC: t("newsRegionApac"),
          GLOBAL: t("newsRegionGlobal"),
        },
        categories: {
          trending: tIndex("catTrending"),
          transfer: tIndex("catTransfer"),
          epl: tIndex("catEpl"),
          worldcup: tIndex("catWorldCup"),
          leagues: tIndex("catLeagues"),
          events: tIndex("catEvents"),
        },
      }}
      />
    </div>
  );
}
