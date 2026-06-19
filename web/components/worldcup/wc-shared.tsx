"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export function WcCopyNameButton({
  name,
  copyLabel,
  copiedLabel,
  className,
}: {
  name: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(name);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    },
    [name],
  );

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "shrink-0 rounded-md border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:border-brand-accent/40 hover:bg-brand-accent/10 hover:text-brand-accent",
        className,
      )}
      aria-label={copyLabel}
      title={copyLabel}
    >
      {copied ? (
        <span className="block px-0.5 text-[10px] font-medium text-brand-accent">
          {copiedLabel}
        </span>
      ) : (
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

/** Player name that wraps on small screens + optional copy for FIFA search. */
export function WcPlayerNameRow({
  name,
  rank,
  copyLabel,
  copiedLabel,
  className,
}: {
  name: string;
  rank?: number;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5", className)}>
      {rank != null ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {rank}
        </span>
      ) : null}
      <span
        className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground [overflow-wrap:anywhere]"
      >
        {name}
      </span>
      <WcCopyNameButton
        name={name}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        className="mt-0"
      />
    </div>
  );
}

export function WcStatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex min-h-[2.5rem] flex-col items-center justify-center gap-0.5 rounded-md bg-card px-1.5 py-1.5 text-center">
      <div className="text-[10px] font-medium uppercase leading-none tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-semibold leading-none tabular-nums",
          accent ? "text-brand-accent" : "text-foreground/90",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function WcSectionIntro({
  title,
  summary,
  detail,
  moreLabel = "More",
}: {
  title: string;
  summary?: string;
  detail?: string;
  moreLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight text-foreground md:text-xl">
        {title}
      </h2>
      {summary ? (
        <p className="max-w-2xl text-sm text-muted-foreground">{summary}</p>
      ) : null}
      {detail ? (
        <details className="group max-w-2xl text-sm text-muted-foreground">
          <summary className="cursor-pointer list-none text-muted-foreground transition-colors hover:text-foreground/70 [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-1">
              <span className="text-brand-accent group-open:rotate-90">›</span>
              {moreLabel}
            </span>
          </summary>
          <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </details>
      ) : null}
    </div>
  );
}

export function WcAboutPanel({
  poolNote,
  disclaimer,
  scoutingNote,
  matchesNote,
  tablesNote,
  newsNote,
  moreLabel,
}: {
  poolNote?: string;
  disclaimer?: string;
  scoutingNote?: string;
  matchesNote?: string;
  tablesNote?: string;
  newsNote?: string;
  moreLabel: string;
}) {
  if (
    !poolNote &&
    !disclaimer &&
    !scoutingNote &&
    !matchesNote &&
    !tablesNote &&
    !newsNote
  ) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
      <summary className="cursor-pointer list-none font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
        {moreLabel}
      </summary>
      <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
        {poolNote ? <p className="text-amber-200/90">{poolNote}</p> : null}
        {disclaimer ? <p>{disclaimer}</p> : null}
        {scoutingNote ? <p>{scoutingNote}</p> : null}
        {matchesNote ? <p>{matchesNote}</p> : null}
        {tablesNote ? <p>{tablesNote}</p> : null}
        {newsNote ? <p>{newsNote}</p> : null}
      </div>
    </details>
  );
}
