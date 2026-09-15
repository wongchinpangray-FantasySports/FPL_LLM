"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Lock } from "lucide-react";
import { FplEntryConfirmField } from "@/components/fpl/fpl-entry-confirm-field";
import type { FplEntryPreview } from "@/lib/fpl/entry-preview";
import type { ProTeaser } from "@/lib/billing/pro-teaser";

export type ProTeaserPanelLabels = {
  teaserTitle: string;
  teaserHint: string;
  teaserPlaceholder: string;
  teaserLookup: string;
  teaserLookingUp: string;
  teaserConfirmPrompt: string;
  teaserConfirmYes: string;
  teaserChange: string;
  teaserInvalid: string;
  teaserNotFound: string;
  teaserLookupFailed: string;
  teaserTeam: string;
  teaserManager: string;
  teaserGenerate: string;
  teaserGenerating: string;
  teaserError: string;
  teaserPoints: string;
  teaserOr: string;
  teaserBank: string;
  teaserFt: string;
  teaserChips: string;
  teaserDeadline: string;
  teaserProblems: string;
  teaserLocked: string;
  teaserCta: string;
};

export function ProTeaserPanel({
  labels,
  onEntryIdChange,
}: {
  labels: ProTeaserPanelLabels;
  onEntryIdChange?: (entryId: number | null) => void;
}) {
  const locale = useLocale();
  const [value, setValue] = useState("");
  const [confirmed, setConfirmed] = useState<FplEntryPreview | null>(null);
  const [teaser, setTeaser] = useState<ProTeaser | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleConfirmed(preview: FplEntryPreview | null) {
    setConfirmed(preview);
    setTeaser(null);
    setError(null);
    onEntryIdChange?.(preview?.entry_id ?? null);
  }

  useEffect(() => {
    if (!confirmed) return;
    const entryId = confirmed.entry_id;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const res = await fetch("/api/pro/teaser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryId,
            locale: locale === "en" ? "en" : "zh",
          }),
        });
        const data = (await res.json()) as { teaser?: ProTeaser; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.teaser) {
          throw new Error(data.error ?? labels.teaserError);
        }
        setTeaser(data.teaser);
        onEntryIdChange?.(data.teaser.entryId);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : labels.teaserError);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generate once per confirmed entry
  }, [confirmed?.entry_id, locale]);


  return (
    <div
      id="teaser"
      className="rounded-2xl border border-brand-accent/35 bg-card p-4 sm:p-5"
    >
      <h2 className="text-sm font-semibold text-foreground">{labels.teaserTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{labels.teaserHint}</p>

      <div className="mt-4">
        <FplEntryConfirmField
          value={value}
          onChange={setValue}
          confirmed={confirmed}
          onConfirmedChange={handleConfirmed}
          labels={{
            placeholder: labels.teaserPlaceholder,
            lookup: labels.teaserLookup,
            lookingUp: labels.teaserLookingUp,
            confirmPrompt: labels.teaserConfirmPrompt,
            confirmed: labels.teaserConfirmYes,
            change: labels.teaserChange,
            invalid: labels.teaserInvalid,
            notFound: labels.teaserNotFound,
            lookupFailed: labels.teaserLookupFailed,
            teamLabel: labels.teaserTeam,
            managerLabel: labels.teaserManager,
          }}
        />
      </div>

      {busy && confirmed && !teaser ? (
        <p className="mt-3 text-sm text-muted-foreground">{labels.teaserGenerating}</p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-amber-200">{error}</p>
      ) : null}

      {teaser ? (
        <div className="mt-5 flex flex-col gap-4">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{teaser.teamName}</span>
            <span className="text-muted-foreground"> · {teaser.managerName}</span>
            {teaser.snapshot.nextGw != null ? (
              <span className="text-muted-foreground">
                {" "}
                · GW{teaser.snapshot.nextGw}
              </span>
            ) : null}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label={labels.teaserPoints} value={String(teaser.snapshot.points ?? "—")} />
            <Stat label={labels.teaserOr} value={teaser.snapshot.overallRankLabel} />
            <Stat label={labels.teaserBank} value={teaser.snapshot.bankLabel} />
            <Stat
              label={labels.teaserFt}
              value={String(teaser.snapshot.freeTransfers)}
            />
            <Stat label={labels.teaserChips} value={teaser.snapshot.chipsLabel} />
            <Stat label={labels.teaserDeadline} value={teaser.snapshot.deadlineLabel} />
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.teaserProblems}
            </h3>
            <ol className="mt-2 space-y-2">
              {teaser.problems.map((p, i) => (
                <li
                  key={p.kind}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <p className="text-sm font-medium text-foreground">
                    {i + 1}. {p.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ol>
          </div>

          <p className="rounded-lg border border-dashed border-border px-3 py-2 font-mono text-sm text-muted-foreground">
            {teaser.redactedPlan}
          </p>

          <div
            aria-hidden
            className="pointer-events-none select-none overflow-hidden rounded-lg border border-border"
          >
            <table className="w-full blur-[5px] text-sm opacity-50">
              <thead>
                <tr className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5">FT</th>
                  <th className="px-3 py-1.5">IN → OUT</th>
                  <th className="px-3 py-1.5">xP</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2">#1</td>
                  <td className="px-3 py-2">░░░░ → ░░░░</td>
                  <td className="px-3 py-2">+?.?</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {labels.teaserLocked}
            </h3>
            <ul className="mt-2 space-y-1.5">
              {teaser.locked.map((row) => (
                <li
                  key={row.id}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <a
            href="#pay"
            className="inline-flex items-center justify-center rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-ink no-underline"
          >
            {labels.teaserCta}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
