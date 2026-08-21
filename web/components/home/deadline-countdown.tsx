"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type DeadlineCountdownLabels = {
  /** e.g. "{d}d {h}:{m}:{s}" or Chinese "{d}天 {h}:{m}:{s}" */
  remainingWithDays: string;
  /** e.g. "{h}:{m}:{s}" */
  remaining: string;
  passed: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatRemaining(
  ms: number,
  labels: DeadlineCountdownLabels,
): string {
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const h = pad2(hours);
  const m = pad2(mins);
  const s = pad2(secs);
  if (days > 0) {
    return labels.remainingWithDays
      .replace("{d}", String(days))
      .replace("{h}", h)
      .replace("{m}", m)
      .replace("{s}", s);
  }
  return labels.remaining
    .replace("{h}", h)
    .replace("{m}", m)
    .replace("{s}", s);
}

type Props = {
  deadlineIso: string;
  labels: DeadlineCountdownLabels;
  className?: string;
};

/**
 * Live FPL deadline countdown. Ticks every second while the tab is visible.
 */
export function DeadlineCountdown({
  deadlineIso,
  labels,
  className,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [deadlineIso]);

  const target = new Date(deadlineIso).getTime();
  if (!Number.isFinite(target)) return null;

  const remaining = target - now;
  const passed = remaining <= 0;
  const urgent = !passed && remaining < 60 * 60 * 1000;
  const critical = !passed && remaining < 15 * 60 * 1000;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold tabular-nums tracking-tight",
        passed && "text-muted-foreground",
        urgent && !critical && "text-amber-300",
        critical && "text-rose-300",
        !passed && !urgent && "text-brand-accent",
        className,
      )}
      aria-live="polite"
    >
      {passed
        ? labels.passed
        : formatRemaining(remaining, labels)}
    </span>
  );
}
