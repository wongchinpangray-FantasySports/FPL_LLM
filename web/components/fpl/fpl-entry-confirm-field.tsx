"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FplEntryPreview } from "@/lib/fpl/entry-preview";
import { cn } from "@/lib/utils";

export type FplEntryConfirmLabels = {
  label?: string;
  hint?: string;
  placeholder: string;
  lookup: string;
  lookingUp: string;
  confirmPrompt: string;
  confirmed: string;
  change: string;
  invalid: string;
  notFound: string;
  lookupFailed: string;
  teamLabel: string;
  managerLabel: string;
  optionalEmptyHint?: string;
};

type Props = {
  labels: FplEntryConfirmLabels;
  /** Controlled value of the Entry ID input. */
  value: string;
  onChange: (value: string) => void;
  /** Confirmed preview, or null if not confirmed / cleared. */
  confirmed: FplEntryPreview | null;
  onConfirmedChange: (preview: FplEntryPreview | null) => void;
  className?: string;
  /** When true, empty is allowed (onboarding optional). */
  optional?: boolean;
};

export function FplEntryConfirmField({
  labels,
  value,
  onChange,
  confirmed,
  onConfirmedChange,
  className,
  optional = false,
}: Props) {
  const [lookingUp, setLookingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<FplEntryPreview | null>(null);

  const lookup = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      if (optional) {
        setError(null);
        setPending(null);
        onConfirmedChange(null);
        return;
      }
      setError(labels.invalid);
      return;
    }
    if (!/^\d+$/.test(trimmed)) {
      setError(labels.invalid);
      return;
    }

    setLookingUp(true);
    setError(null);
    setPending(null);
    onConfirmedChange(null);
    try {
      const res = await fetch(
        `/api/fpl/entry-preview?entryId=${encodeURIComponent(trimmed)}`,
      );
      const data = (await res.json()) as {
        preview?: FplEntryPreview;
        error?: string;
      };
      if (!res.ok || !data.preview) {
        throw new Error(
          data.error ?? (res.status === 404 ? labels.notFound : labels.lookupFailed),
        );
      }
      setPending(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.lookupFailed);
    } finally {
      setLookingUp(false);
    }
  }, [value, optional, labels, onConfirmedChange]);

  function confirmPending() {
    if (!pending) return;
    onConfirmedChange(pending);
    onChange(String(pending.entry_id));
    setPending(null);
    setError(null);
  }

  function resetConfirm() {
    onConfirmedChange(null);
    setPending(null);
    setError(null);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {labels.label ? (
        <label className="block text-sm font-medium text-foreground">
          {labels.label}
        </label>
      ) : null}
      {labels.hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {labels.hint}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Input
          inputMode="numeric"
          pattern="\d*"
          placeholder={labels.placeholder}
          value={value}
          disabled={confirmed != null}
          onChange={(e) => {
            onChange(e.target.value);
            if (confirmed) onConfirmedChange(null);
            setPending(null);
            setError(null);
          }}
          className="min-w-[10rem] flex-1"
        />
        {confirmed ? (
          <Button type="button" variant="secondary" size="sm" onClick={resetConfirm}>
            {labels.change}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={lookingUp || (!value.trim() && !optional)}
            onClick={() => void lookup()}
          >
            {lookingUp ? labels.lookingUp : labels.lookup}
          </Button>
        )}
      </div>

      {optional && !value.trim() && !confirmed && !pending ? (
        <p className="text-xs text-muted-foreground">
          {labels.optionalEmptyHint}
        </p>
      ) : null}

      {pending && !confirmed ? (
        <div className="rounded-lg border border-brand-accent/40 bg-brand-accent/10 px-3 py-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-accent">
            {labels.confirmPrompt}
          </p>
          <dl className="grid gap-1.5 text-foreground/90">
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">
                {labels.teamLabel}
              </dt>
              <dd className="font-medium">{pending.team_name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">
                {labels.managerLabel}
              </dt>
              <dd>{pending.manager_name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-muted-foreground">
                Entry ID
              </dt>
              <dd className="tabular-nums">#{pending.entry_id}</dd>
            </div>
          </dl>
          <Button
            type="button"
            size="sm"
            className="mt-3"
            onClick={confirmPending}
          >
            {labels.confirmed}
          </Button>
        </div>
      ) : null}

      {confirmed ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          <p className="font-medium">
            {confirmed.team_name}{" "}
            <span className="font-normal text-emerald-100/80">
              · {confirmed.manager_name} · #{confirmed.entry_id}
            </span>
          </p>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
