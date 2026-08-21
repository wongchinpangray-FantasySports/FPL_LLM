"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type Props = {
  deadlineIso: string;
  className?: string;
};

/**
 * Live FPL deadline countdown. Ticks every second while the tab is visible.
 */
export function DeadlineCountdown({ deadlineIso, className }: Props) {
  const t = useTranslations("home");
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

  let label = t("deadlinePassed");
  if (!passed) {
    const totalSec = Math.floor(remaining / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const values = {
      d: days,
      h: pad2(hours),
      m: pad2(mins),
      s: pad2(secs),
    };
    label =
      days > 0
        ? t("deadlineCountdownDays", values)
        : t("deadlineCountdown", values);
  }

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
      {label}
    </span>
  );
}
