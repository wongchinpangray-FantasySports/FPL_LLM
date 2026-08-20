import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { ScoutArticleList } from "@/components/scout/scout-article-list";
import { listPublishedScoutArticles } from "@/lib/scout/store";
import type { ScoutSeries } from "@/lib/scout/types";

export const dynamic = "force-dynamic";

type Props = { params: { locale: string } };

const SERIES: ScoutSeries[] = [
  "team_guide",
  "scout_report",
  "scout_notes",
  "preview",
  "review",
  "team_news",
  "scout_squad",
  "other",
];

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations({ locale: params.locale, namespace: "scout" });
  return { title: t("listTitle"), description: t("listSummary") };
}

export default async function ScoutIndexPage({ params }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "scout" });
  const common = await getTranslations({ locale: params.locale, namespace: "common" });
  let items: Awaited<ReturnType<typeof listPublishedScoutArticles>> = [];
  try {
    items = await listPublishedScoutArticles(60);
  } catch {
    items = [];
  }
  const series = Object.fromEntries(
    SERIES.map((key) => [key, t(`series.${key}`)]),
  );

  return (
    <PageShell
      backHref="/"
      backLabel={common("backHome")}
      eyebrow={t("eyebrow")}
      title={t("listTitle")}
      description={t("listSummary")}
      width="6xl"
    >
      <ScoutArticleList
        items={items}
        locale={params.locale}
        labels={{
          empty: t("empty"),
          partner: t("partner"),
          read: t("read"),
          series,
        }}
      />
    </PageShell>
  );
}
