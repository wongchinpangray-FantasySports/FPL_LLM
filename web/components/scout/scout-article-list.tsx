import { Link } from "@/i18n/navigation";
import { NewsThumb } from "@/components/news/news-thumb";
import { NewsSubNav } from "@/components/news/news-sub-nav";
import type { ScoutArticleListItem } from "@/lib/scout/types";
import { displayScoutExcerpt, displayScoutTitle } from "@/lib/scout/zh-status";

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export function ScoutArticleList({
  items,
  locale,
  labels,
}: {
  items: ScoutArticleListItem[];
  locale: string;
  labels: {
    empty: string;
    partner: string;
    read: string;
    series: Record<string, string>;
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      <NewsSubNav />
      {items.length === 0 ? (
        <p className="rounded-xl border border-border bg-card/40 px-4 py-8 text-sm text-muted-foreground">
          {labels.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:bg-card"
            >
              <Link
                href={`/scout/${item.slug}`}
                className="flex flex-col no-underline sm:flex-row"
              >
                <div className="sm:w-44">
                  <NewsThumb
                    imageUrl={item.hero_image_url}
                    outlet="FFS"
                    size={176}
                    className="!h-40 !w-full rounded-none sm:!min-h-[9rem]"
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
                      {labels.partner}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {labels.series[item.series] ?? item.series}
                    </span>
                    {item.source_published_at ? (
                      <span className="text-[11px] text-muted-foreground">
                        {fmtDate(item.source_published_at, locale)}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-base font-semibold leading-snug text-foreground">
                    {displayScoutTitle(item)}
                  </h2>
                  {displayScoutExcerpt(item) ? (
                    <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {displayScoutExcerpt(item)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-medium text-brand-accent">
                    {labels.read}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
