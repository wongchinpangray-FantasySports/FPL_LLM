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
  searchParams?: { category?: string };
};

export default function NewsPage({ searchParams }: Props) {
  const raw = searchParams?.category?.toLowerCase();
  const category =
    raw && CATEGORIES.has(raw as NewsCategory) ? (raw as NewsCategory) : "trending";

  return (
    <div className="flex flex-col gap-4">
      <NewsPageContent defaultCategory={category} />
    </div>
  );
}
