"use client";

import { FFS_PREMIUM_QR_PATH, scoutGoHref } from "@/lib/scout/links";

export function ScoutCta({
  slug,
  articleId,
  sourceUrl,
  labels,
}: {
  slug: string;
  articleId: string;
  sourceUrl: string;
  labels: {
    partner: string;
    premiumTitle: string;
    premiumBody: string;
    premiumButton: string;
    raterButton: string;
    originalButton: string;
    qrHint: string;
    credit: string;
  };
}) {
  const go = (target: "premium" | "team-rater" | "original" | "qr") =>
    scoutGoHref(target, { slug, articleId });

  return (
    <aside className="overflow-hidden rounded-xl border border-brand-accent/30 bg-brand-accent/5">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
            {labels.partner}
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {labels.premiumTitle}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {labels.premiumBody}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={go("premium")}
              className="inline-flex items-center rounded-lg bg-brand-accent px-3 py-1.5 text-sm font-semibold text-brand-ink no-underline hover:opacity-90"
            >
              {labels.premiumButton}
            </a>
            <a
              href={go("team-rater")}
              className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground no-underline hover:border-brand-accent/40"
            >
              {labels.raterButton}
            </a>
            <a
              href={go("original")}
              className="inline-flex items-center rounded-lg border border-transparent px-3 py-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"
            >
              {labels.originalButton}
            </a>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{labels.credit}</p>
        </div>
        <a
          href={go("qr")}
          className="mx-auto flex w-[9.5rem] shrink-0 flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2 no-underline sm:mx-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FFS_PREMIUM_QR_PATH}
            alt=""
            width={140}
            height={140}
            className="h-[140px] w-[140px] rounded-md bg-white object-contain p-1"
            onError={(e) => {
              const img = e.currentTarget;
              const dest = go("premium");
              const origin =
                typeof window !== "undefined" ? window.location.origin : "";
              const data = encodeURIComponent(
                origin ? `${origin}${dest}` : dest,
              );
              img.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${data}`;
            }}
          />
          <span className="text-center text-[10px] leading-snug text-muted-foreground">
            {labels.qrHint}
          </span>
        </a>
      </div>
      <span className="sr-only">{sourceUrl}</span>
    </aside>
  );
}
