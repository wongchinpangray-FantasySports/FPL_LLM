"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function speechLang(locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

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
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopSpeech = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    utteranceRef.current = null;
    setSpeaking(false);
    setPaused(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopSpeech();
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

  useEffect(() => () => stopSpeech(), [stopSpeech]);

  const startSpeech = useCallback(() => {
    if (!summary || typeof window === "undefined" || !window.speechSynthesis) {
      return;
    }
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.lang = speechLang(locale);
    utterance.rate = 0.95;
    utterance.onend = () => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setSpeaking(false);
      setPaused(false);
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  }, [summary, locale, stopSpeech]);

  const togglePause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [paused]);

  if (!open) return null;

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
        onClick={() => {
          stopSpeech();
          onClose();
        }}
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
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3 sm:px-5">
          {summary ? (
            <>
              {!speaking ? (
                <Button type="button" variant="secondary" onClick={startSpeech}>
                  {labels.listen}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="secondary" onClick={togglePause}>
                    {paused ? labels.resume : labels.pause}
                  </Button>
                  <Button type="button" variant="secondary" onClick={stopSpeech}>
                    {labels.stop}
                  </Button>
                </>
              )}
            </>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              stopSpeech();
              onClose();
            }}
          >
            {labels.close}
          </Button>
        </div>
      </div>
    </div>
  );
}
