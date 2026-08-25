"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { MiniLeagueBetaView } from "@/lib/fpl/mini-league/beta-types";

const BETA_ERROR_KEYS = [
  "short",
  "long",
  "forbidden",
  "rate_limited",
  "missing_table",
  "invalid",
  "revoked",
  "taken",
] as const;

function betaErrorMessage(
  t: ReturnType<typeof useTranslations<"miniLeague.beta">>,
  code: string | undefined,
  fallback: string,
): string {
  if (code && (BETA_ERROR_KEYS as readonly string[]).includes(code)) {
    return t(`errors.${code as (typeof BETA_ERROR_KEYS)[number]}`);
  }
  return fallback;
}

const TOOL_OPTIONS = [
  "general",
  "rankHistory",
  "chips",
  "liveGw",
  "beatRival",
  "fixtures",
  "h2h",
] as const;

export function MiniLeagueFeedbackForm({ compact }: { compact?: boolean }) {
  const t = useTranslations("miniLeague.beta");
  const [toolId, setToolId] = useState<(typeof TOOL_OPTIONS)[number]>("general");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/fpl/mini-league/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          toolId,
          rating: rating || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(betaErrorMessage(t, data.error, t("sendError")));
      }
      setDone(true);
      setBody("");
      setRating(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("sendError"));
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        {t("thanks")}
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-2")}>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("toolLabel")}
          </span>
          <select
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            value={toolId}
            onChange={(e) =>
              setToolId(e.target.value as (typeof TOOL_OPTIONS)[number])
            }
          >
            {TOOL_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {t(`tools.${id}`)}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("ratingLabel")}
          </legend>
          <div className="flex gap-1 pt-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n === rating ? 0 : n)}
                className={cn(
                  "h-8 w-8 rounded-md border text-sm",
                  rating >= n
                    ? "border-amber-400/50 bg-amber-400/20 text-amber-200"
                    : "border-border text-muted-foreground",
                )}
                aria-label={t("star", { n })}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("commentLabel")}
        </span>
        <textarea
          required
          minLength={8}
          maxLength={4000}
          rows={compact ? 3 : 4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("commentPlaceholder")}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <button
        type="submit"
        disabled={sending || body.trim().length < 8}
        className="inline-flex w-fit rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-brand-ink hover:opacity-90 disabled:opacity-60"
      >
        {sending ? t("sending") : t("send")}
      </button>
    </form>
  );
}

export function MiniLeagueBetaBanner({ beta }: { beta: MiniLeagueBetaView }) {
  const t = useTranslations("miniLeague.beta");
  const [open, setOpen] = useState(false);
  if (beta.role !== "tester" && beta.role !== "admin" && beta.role !== "allowlist") {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{t("bannerTitle")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {beta.role === "tester" && beta.startEvent && beta.endEvent
              ? t("bannerWindow", {
                  from: beta.startEvent,
                  to: beta.endEvent,
                  left: beta.remainingGws ?? 0,
                })
              : t("bannerAdmin")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200"
        >
          {open ? t("hideFeedback") : t("giveFeedback")}
        </button>
      </div>
      {open ? (
        <div className="mt-3 border-t border-emerald-500/20 pt-3">
          <MiniLeagueFeedbackForm compact />
        </div>
      ) : null}
    </div>
  );
}
