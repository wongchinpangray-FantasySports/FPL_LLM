"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { WcNewsItem, WcNewsRegion } from "@/lib/wc/news-feeds";
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
  };
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imgSrc = proxiedNewsImageUrl(item.image_url);
  const showImage = Boolean(imgSrc) && !imgFailed;

  return (
    <article className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/[0.14] hover:bg-white/[0.04]">
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
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
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
            <span className="text-[10px] uppercase text-slate-600">{item.lang}</span>
          </div>

          <h3 className="text-sm font-semibold leading-snug text-white sm:text-base">
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
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
              {item.summary}
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-slate-500">
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
  disclaimer: string;
  error?: string;
};

export function WcNewsPanel({
  locale,
  title,
  summary,
  detail,
  moreLabel,
  labels,
}: {
  locale: string;
  title: string;
  summary: string;
  detail?: string;
  moreLabel: string;
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
  };
}) {
  const [region, setRegion] = useState("ALL");
  const [editorialOnly, setEditorialOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NewsPayload | null>(null);

  const load = useCallback(
    async (regionFilter: string, editorial: boolean, refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({
          region: regionFilter,
          limit: "80",
        });
        if (editorial) q.set("editorial", "1");
        if (refresh) q.set("refresh", "1");
        const res = await fetch(`/api/worldcup/news?${q.toString()}`);
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
    void load(region, editorialOnly);
  }, [load, region, editorialOnly]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <WcSectionIntro
          title={title}
          summary={summary}
          detail={detail}
          moreLabel={moreLabel}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={editorialOnly}
              onChange={(e) => setEditorialOnly(e.target.checked)}
              className="rounded border-white/20 bg-slate-900"
            />
            {labels.editorialOnly}
          </label>
          <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
            <span>{labels.filterRegion}</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-1.5 text-sm text-white"
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
            onClick={() => void load(region, editorialOnly, true)}
            disabled={loading}
            className={cn(
              "rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 transition-colors",
              "hover:border-brand-accent/40 hover:text-white disabled:opacity-50",
            )}
          >
            {labels.refresh}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{labels.loading}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500">{labels.empty}</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <p className="text-xs text-slate-500">
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
                }}
              />
            ))}
          </div>
          {data?.disclaimer ? (
            <p className="text-xs leading-relaxed text-slate-600">
              {data.disclaimer}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
