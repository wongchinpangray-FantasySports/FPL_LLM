"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { NewsCategory, WcNewsItem, WcNewsRegion } from "@/lib/wc/news-feeds";
import { proxiedNewsImageUrl } from "@/lib/news-image";
import { WcSectionIntro } from "@/components/worldcup/wc-shared";

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

function regionLabel(region: WcNewsRegion, labels: Record<string, string>): string {
  return labels[region] ?? region;
}

function NewsCard({
  item,
  locale,
  labels,
}: {
  item: WcNewsItem;
  locale: string;
  labels: {
    editorialBadge: string;
    readMore: string;
    regions: Record<string, string>;
    categories?: Record<string, string>;
  };
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = proxiedNewsImageUrl(item.image_url);
  const showImage = Boolean(imgSrc) && !imgFailed;

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/50 transition-colors hover:border-border hover:bg-card">
      <div className={cn("flex flex-col", showImage && "sm:flex-row")}>
        {showImage ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block shrink-0 sm:w-36 md:w-44"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc!}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="h-36 w-full object-cover sm:h-full sm:min-h-[8.5rem]"
            />
          </a>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
              {item.outlet}
            </span>
            <span className="rounded-full bg-brand-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-accent">
              {regionLabel(item.region, labels.regions)}
            </span>
            {item.is_editorial ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-200">
                {labels.editorialBadge}
              </span>
            ) : null}
            {labels.categories?.[item.category] ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300/90">
                {labels.categories[item.category]}
              </span>
            ) : null}
            <span className="text-[10px] uppercase text-muted-foreground/80">{item.lang}</span>
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

type NewsPayload = {
  items: WcNewsItem[];
  total: number;
  category?: string;
  disclaimer: string;
  error?: string;
};

const CATEGORY_TABS: NewsCategory[] = [
  "trending",
  "transfer",
  "epl",
  "worldcup",
  "leagues",
  "events",
];

export function WcNewsPanel({
  locale,
  title,
  summary,
  detail,
  moreLabel,
  labels,
  defaultCategory = "trending",
}: {
  locale: string;
  title: string;
  summary: string;
  detail?: string;
  moreLabel: string;
  defaultCategory?: NewsCategory;
  labels: {
    filterRegion: string;
    regionAll: string;
    editorialOnly: string;
    editorialBadge: string;
    readMore: string;
    loading: string;
    empty: string;
    refresh: string;
    count: string;
    regions: Record<string, string>;
    categories: Record<string, string>;
  };
}) {
  const [category, setCategory] = useState<NewsCategory>(defaultCategory);
  const [region, setRegion] = useState("ALL");
  const [editorialOnly, setEditorialOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsPayload | null>(null);

  const load = useCallback(
    async (
      categoryFilter: NewsCategory,
      regionFilter: string,
      editorial: boolean,
      refresh = false,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({
          category: categoryFilter,
          region: regionFilter,
          limit: "60",
        });
        if (editorial) q.set("editorial", "1");
        if (refresh) q.set("refresh", "1");
        const res = await fetch(`/api/news?${q.toString()}`);
        const json = (await res.json()) as NewsPayload;
        if (!res.ok) throw new Error(json.error ?? "Failed to load news");
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load news");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    void load(category, region, editorialOnly);
  }, [load, category, region, editorialOnly]);

  const regionOptions = [
    { value: "ALL", label: labels.regionAll },
    { value: "US", label: labels.regions.US },
    { value: "UK", label: labels.regions.UK },
    { value: "EU", label: labels.regions.EU },
    { value: "LATAM", label: labels.regions.LATAM },
    { value: "APAC", label: labels.regions.APAC },
    { value: "GLOBAL", label: labels.regions.GLOBAL },
  ];

  const items = data?.items ?? [];

  return (
    <section className="flex flex-col gap-4">
      <WcSectionIntro
        title={title}
        summary={summary}
        detail={detail}
        moreLabel={moreLabel}
      />

      <div className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setCategory(tab)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              category === tab
                ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {labels.categories[tab] ?? tab}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={editorialOnly}
            onChange={(e) => setEditorialOnly(e.target.checked)}
            className="rounded border-border bg-popover"
          />
          {labels.editorialOnly}
        </label>
        <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <span>{labels.filterRegion}</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="rounded-md border border-border bg-popover/80 px-2 py-1.5 text-sm text-foreground"
          >
            {regionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load(category, region, editorialOnly, true)}
          disabled={loading}
          className={cn(
            "rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground/70 transition-colors",
            "hover:border-brand-accent/40 hover:text-foreground disabled:opacity-50",
          )}
        >
          {labels.refresh}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {labels.count.replace("{n}", String(items.length))}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                locale={locale}
                labels={{
                  editorialBadge: labels.editorialBadge,
                  readMore: labels.readMore,
                  regions: labels.regions,
                  categories: labels.categories,
                }}
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
