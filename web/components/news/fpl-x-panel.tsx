"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import type { FplXTopic } from "@/lib/fpl/fpl-x-feed";
import { filterFplXItems } from "@/lib/fpl/fpl-x-feed";
import { NewsThumb } from "@/components/news/news-thumb";
import { NewsSubNav } from "@/components/news/news-sub-nav";

function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function FplXTweetCard({
  item,
  locale,
  readMore,
}: {
  item: WcNewsItem;
  locale: string;
  readMore: string;
}) {
  const hasImage = Boolean(item.image_url?.trim());

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:border-border hover:bg-card">
      <div className={cn("flex flex-col", hasImage && "sm:flex-row")}>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "relative block shrink-0 overflow-hidden bg-muted/30",
            hasImage ? "sm:w-36 md:w-44" : "hidden",
          )}
        >
          <NewsThumb
            imageUrl={item.image_url}
            outlet={item.outlet}
            size={160}
            className="!h-36 !w-full rounded-none sm:!min-h-[8.5rem]"
          />
        </a>
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              {item.outlet}
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
              X
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

          {item.summary && item.summary !== item.title ? (
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-muted-foreground">
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
              {readMore} →
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

type FplXPayload = {
  items: WcNewsItem[];
  total: number;
  fetched_at?: string;
  disclaimer?: string;
  error?: string;
};

const TOPIC_TABS: FplXTopic[] = ["all", "injury", "lineup", "transfer"];

export function FplXPanel({
  locale,
  labels,
}: {
  locale: string;
  labels: {
    readMore: string;
    loading: string;
    empty: string;
    refresh: string;
    count: string;
    updating: string;
    openOnX: string;
    topics: Record<FplXTopic, string>;
  };
}) {
  const [topic, setTopic] = useState<FplXTopic>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FplXPayload | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "40" });
      if (refresh) q.set("refresh", "1");
      const res = await fetch(`/api/news/fpl-x?${q.toString()}`);
      const json = (await res.json()) as FplXPayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load FPL posts");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load FPL posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(
    () => filterFplXItems(data?.items ?? [], topic),
    [data?.items, topic],
  );

  return (
    <section className="flex flex-col gap-4">
      <NewsSubNav />

      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TOPIC_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTopic(tab)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              topic === tab
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {labels.topics[tab]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
          className={cn(
            "rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/70 transition-colors",
            "hover:border-brand-accent/40 hover:text-foreground disabled:opacity-50",
          )}
        >
          {labels.refresh}
        </button>
        <a
          href="https://x.com/search?q=FPL%20(injury%20OR%20lineup%20OR%20transfer)&src=typed_query&f=live"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-brand-accent no-underline hover:underline"
        >
          {labels.openOnX} →
        </a>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}
      {refreshing && data ? (
        <p className="text-xs text-muted-foreground">{labels.updating}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}

      {!error && items.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {labels.count.replace("{n}", String(items.length))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <FplXTweetCard
                key={item.id}
                item={item}
                locale={locale}
                readMore={labels.readMore}
              />
            ))}
          </div>
          {data?.disclaimer ? (
            <p className="text-xs leading-relaxed text-muted-foreground/80">
              {data.disclaimer}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
