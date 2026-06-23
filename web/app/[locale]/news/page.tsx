import { setRequestLocale, getTranslations } from "next-intl/server";
import { PageShell } from "@/components/page-shell";
import { NewsPageContent } from "@/components/news/news-page-content";
import type { NewsCategory } from "@/lib/wc/news-feeds";

const CATEGORIES = new Set<NewsCategory>([
  "trending",
  "transfer",
  "epl",
  "worldcup",
  "leagues",
  "events",
]);

type Props = {
  params: { locale: string };
  searchParams?: { category?: string };
};

export default async function NewsPage({ params, searchParams }: Props) {
  setRequestLocale(params.locale);
  const t = await getTranslations({ locale: params.locale, namespace: "newsIndex" });
  const raw = searchParams?.category?.toLowerCase();
  const category =
    raw && CATEGORIES.has(raw as NewsCategory) ? (raw as NewsCategory) : "trending";

  return (
    <PageShell title={t("title")} description={t("summary")} width="6xl">
      <NewsPageContent defaultCategory={category} />
    </PageShell>
  );
}
