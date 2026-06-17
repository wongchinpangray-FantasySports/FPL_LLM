"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMatchSummarySpeech } from "@/lib/wc/use-match-summary-speech";

export function WcMatchSummaryModal({
  open,
  title,
  matchId,
  locale,
  labels,
  onClose,
}: {
  open: boolean;
  title: string;
  matchId: number;
  locale: string;
  labels: {
    loading: string;
    error: string;
    audioLoading: string;
    listen: string;
    pause: string;
    resume: string;
    stop: string;
    close: string;
  };
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const { speaking, paused, audioLoading, play, stop, togglePause } =
    useMatchSummarySpeech(locale);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSummary(null);

    void (async () => {
      try {
        const res = await fetch(
          `/api/worldcup/match-summary?matchId=${encodeURIComponent(String(matchId))}&locale=${encodeURIComponent(locale)}`,
        );
        const json = (await res.json()) as {
          summary?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? labels.error);
        if (!cancelled) setSummary(json.summary ?? "");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : labels.error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, matchId, locale, labels.error]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleClose = useCallback(() => {
    stop();
    onClose();
  }, [stop, onClose]);

  if (!open) return null;

  const listenDisabled = loading || audioLoading || !summary;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wc-match-summary-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={labels.close}
        onClick={handleClose}
      />
      <div
        className={cn(
          "relative z-[101] flex max-h-[85vh] w-full max-w-lg flex-col",
          "rounded-xl border border-white/10 bg-brand-ink shadow-2xl",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-4 py-3 sm:px-5">
          <h2
            id="wc-match-summary-title"
            className="text-base font-semibold text-white sm:text-lg"
          >
            {title}
          </h2>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <p className="text-sm text-slate-400">{labels.loading}</p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : null}
          {summary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {summary}
            </p>
          ) : null}
          {audioLoading ? (
            <p className="mt-3 text-xs text-brand-accent">{labels.audioLoading}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
          {summary ? (
            <>
              {!speaking ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={listenDisabled}
                  onClick={() => void play(summary, matchId)}
                >
                  {labels.listen}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={togglePause}>
                    {paused ? labels.resume : labels.pause}
                  </Button>
                  <Button type="button" variant="secondary" onClick={stop}>
                    {labels.stop}
                  </Button>
                </>
              )}
            </>
          ) : null}
          <Button type="button" onClick={handleClose}>
            {labels.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
