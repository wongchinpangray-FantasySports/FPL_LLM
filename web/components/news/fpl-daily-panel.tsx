"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { FplXDigestRecord, FplXDigestSource } from "@/lib/fpl/fpl-x-digest";
import { NewsSubNav } from "@/components/news/news-sub-nav";

type DigestPayload = {
  digest: (FplXDigestRecord & { summary: string }) | null;
  digest_date: string;
  recent: Array<{
    digest_date: string;
    generated_at: string;
    summary_en: string;
  }>;
  error?: string;
};

function fmtLondonWindow(start: string, end: string, locale: string): string {
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/London",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
  } catch {
    return `${start.slice(0, 16)} – ${end.slice(0, 16)}`;
  }
}

function SourceRow({ source }: { source: FplXDigestSource }) {
  return (
    <li className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground/80">{source.outlet}</span>
      {" — "}
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-accent hover:underline"
      >
        {source.text.slice(0, 120)}
        {source.text.length > 120 ? "…" : ""}
      </a>
    </li>
  );
}

export function FplDailyPanel({
  locale,
  labels,
}: {
  locale: string;
  labels: {
    loading: string;
    empty: string;
    windowLabel: string;
    sourcesTitle: string;
    archiveTitle: string;
    generatedAt: string;
    disclaimer: string;
  };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DigestPayload | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const load = useCallback(
    async (date?: string) => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ locale });
        if (date) q.set("date", date);
        const res = await fetch(`/api/news/fpl-daily?${q.toString()}`);
        const json = (await res.json()) as DigestPayload;
        if (!res.ok && !json.recent?.length) {
          throw new Error(json.error ?? "Failed to load digest");
        }
        setData(json);
        setSelectedDate(json.digest?.digest_date ?? date ?? json.digest_date);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load digest");
      } finally {
        setLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const digest = data?.digest;
  const recent = data?.recent ?? [];

  return (
    <section className="flex flex-col gap-4">
      <NewsSubNav />

      {loading && !digest ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}

      {error && !digest ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !digest && !error ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}

      {digest ? (
        <article className="rounded-xl border border-border bg-card/50 p-5 sm:p-6">
          <header className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-accent/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-accent">
              {digest.digest_date}
            </span>
            <span className="text-xs text-muted-foreground">
              {labels.windowLabel.replace(
                "{window}",
                fmtLondonWindow(digest.window_start, digest.window_end, locale),
              )}
            </span>
          </header>

          <div className="prose prose-invert max-w-none text-sm leading-relaxed text-foreground/90">
            {digest.summary.split(/\n\n+/).map((para) => (
              <p key={para.slice(0, 40)} className="mb-3 last:mb-0">
                {para}
              </p>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            {labels.generatedAt.replace(
              "{time}",
              fmtLondonWindow(digest.generated_at, digest.generated_at, locale),
            )}
          </p>
        </article>
      ) : null}

      {digest && digest.source_items.length > 0 ? (
        <details className="rounded-xl border border-border bg-card/30 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            {labels.sourcesTitle.replace("{n}", String(digest.source_items.length))}
          </summary>
          <ul className="mt-3 space-y-2 pl-1">
            {digest.source_items.map((source) => (
              <SourceRow key={`${source.url}-${source.text.slice(0, 24)}`} source={source} />
            ))}
          </ul>
        </details>
      ) : null}

      {recent.length > 1 ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.archiveTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((row) => (
              <button
                key={row.digest_date}
                type="button"
                onClick={() => void load(row.digest_date)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selectedDate === row.digest_date
                    ? "border-brand-accent/40 bg-brand-accent/10 text-brand-accent"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {row.digest_date}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        {labels.disclaimer}
      </p>
    </section>
  );
}
