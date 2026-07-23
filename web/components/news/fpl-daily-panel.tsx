"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { FplXDigestRecord } from "@/lib/fpl/fpl-x-digest";
import {
  FplDigestDayBlock,
  type FplDigestDayLabels,
} from "@/components/news/fpl-digest-day-block";
import { NewsSubNav } from "@/components/news/news-sub-nav";

type DigestPayload = {
  digest: (FplXDigestRecord & { summary: string }) | null;
  digest_date: string;
  error?: string;
};

export function FplDailyPanel({
  locale,
  labels,
}: {
  locale: string;
  labels: FplDigestDayLabels & {
    loading: string;
    empty: string;
    disclaimer: string;
    archiveLink: string;
  };
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<
    (FplXDigestRecord & { summary: string }) | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ locale });
      const res = await fetch(`/api/news/fpl-daily?${q.toString()}`);
      const json = (await res.json()) as DigestPayload;
      if (!res.ok && !json.digest) {
        throw new Error(json.error ?? "Failed to load digest");
      }
      setDigest(json.digest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load digest");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <FplDigestDayBlock digest={digest} locale={locale} labels={labels} />
      ) : null}

      <p className="text-sm">
        <Link
          href="/news/fpl-x"
          className="font-medium text-brand-accent no-underline hover:underline"
        >
          {labels.archiveLink}
        </Link>
      </p>

      <p className="text-xs leading-relaxed text-muted-foreground/80">
        {labels.disclaimer}
      </p>
    </section>
  );
}
