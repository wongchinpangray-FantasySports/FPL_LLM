"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import {
  FPL_CREATOR_SLUGS,
  creatorKindFromFeedId,
  creatorSlugFromFeedId,
  fplCreatorDisplayName,
  type FplCreatorSlug,
} from "@/lib/fpl/fpl-creators-feed";
import { NewsThumb } from "@/components/news/news-thumb";
import { cn } from "@/lib/utils";

type NewsPayload = {
  items: WcNewsItem[];
  total: number;
  disclaimer: string;
  fetched_at?: string;
  error?: string;
};

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function CreatorCard({
  item,
  locale,
  labels,
}: {
  item: WcNewsItem;
  locale: string;
  labels: { readMore: string; kindArticle: string; kindYoutube: string; kindPodcast: string };
}) {
  const kind = creatorKindFromFeedId(item.feed_id);
  const kindLabel =
    kind === "youtube"
      ? labels.kindYoutube
      : kind === "podcast"
        ? labels.kindPodcast
        : labels.kindArticle;
  const hasImage = Boolean(item.image_url?.trim());

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:border-border hover:bg-card">
      <div className={cn("flex flex-col", hasImage && "sm:flex-row")}>
        {hasImage ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block shrink-0 overflow-hidden bg-muted/30 sm:w-36 md:w-44"
          >
            <NewsThumb
              imageUrl={item.image_url}
              outlet={item.outlet}
              size={160}
              className="!h-36 !w-full rounded-none sm:!min-h-[8.5rem]"
            />
          </a>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              {item.outlet}
            </span>
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-200">
              {kindLabel}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-base">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-brand-accent"
            >
              {item.title}
            </a>
          </h3>
          {item.summary ? (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          ) : null}
          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
            <time dateTime={item.published_at ?? undefined}>
              {fmtDate(item.published_at, locale)}
            </time>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-medium text-brand-accent hover:underline"
            >
              {labels.readMore} →
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

export function FplCreatorsPanel({
  locale,
  labels,
}: {
  locale: string;
  labels: {
    loading: string;
    empty: string;
    refresh: string;
    filterAll: string;
    readMore: string;
    kindArticle: string;
    kindYoutube: string;
    kindPodcast: string;
    disclaimer: string;
  };
}) {
  const tWc = useTranslations("worldcup");
  const [creator, setCreator] = useState<FplCreatorSlug | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<WcNewsItem[]>([]);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ category: "creators", limit: "80" });
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/news?${q.toString()}`);
      const json = (await res.json()) as NewsPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load creators");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load creators");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (creator === "all") return items;
    return items.filter((item) => creatorSlugFromFeedId(item.feed_id) === creator);
  }, [creator, items]);

  const chips: Array<{ id: FplCreatorSlug | "all"; label: string }> = [
    { id: "all", label: labels.filterAll },
    ...FPL_CREATOR_SLUGS.map((slug) => ({
      id: slug,
      label: fplCreatorDisplayName(slug),
    })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setCreator(chip.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              creator === chip.id
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load(true)}
          className="ml-auto rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {labels.refresh}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {tWc("newsCount", { n: filtered.length })}
          </p>
          <div className="grid gap-4">
            {filtered.map((item) => (
              <CreatorCard key={item.id} item={item} locale={locale} labels={labels} />
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">{labels.disclaimer}</p>
    </div>
  );
}
