"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { FplXDigestRecord } from "@/lib/fpl/fpl-x-digest";
import {
  FplDigestDayBlock,
  type FplDigestDayLabels,
} from "@/components/news/fpl-digest-day-block";
import { NewsSubNav } from "@/components/news/news-sub-nav";

type ArchivePayload = {
  days: Array<FplXDigestRecord & { summary: string }>;
  total: number;
  today: string;
  disclaimer?: string;
  error?: string;
};

export function FplXPanel({
  locale,
  labels,
}: {
  locale: string;
  labels: FplDigestDayLabels & {
    loading: string;
    empty: string;
    todayNote: string;
    seeDaily: string;
    disclaimer: string;
    openOnX: string;
  };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ArchivePayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ locale, limit: "30" });
      const res = await fetch(`/api/news/fpl-x?${q.toString()}`);
      const json = (await res.json()) as ArchivePayload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load archive");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = data?.days ?? [];

  return (
    <section className="flex flex-col gap-4">
      <NewsSubNav />

      <p className="rounded-lg border border-border bg-card/40 px-3 py-2 text-sm text-muted-foreground">
        {labels.todayNote}{" "}
        <Link
          href="/news/fpl-daily"
          className="font-medium text-brand-accent no-underline hover:underline"
        >
          {labels.seeDaily}
        </Link>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href="https://x.com/search?q=FPL%20(injury%20OR%20lineup%20OR%20transfer)&src=typed_query&f=live"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-brand-accent no-underline hover:underline"
        >
          {labels.openOnX} →
        </a>
      </div>

      {loading && days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.loading}</p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {!loading && !error && days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}

      {!error && days.length > 0 ? (
        <div className="flex flex-col gap-4">
          {days.map((day) => (
            <FplDigestDayBlock
              key={day.digest_date}
              digest={day}
              locale={locale}
              labels={labels}
            />
          ))}
        </div>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        {data?.disclaimer ?? labels.disclaimer}
      </p>
    </section>
  );
}
