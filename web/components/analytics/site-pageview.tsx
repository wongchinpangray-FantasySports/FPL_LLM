"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "@/i18n/navigation";
import { shouldSkipTracking } from "@/lib/analytics/features";

export function SitePageview() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (shouldSkipTracking(pathname)) return;
    if (typeof navigator !== "undefined" && navigator.webdriver) return;

    const now = Date.now();
    try {
      const prev = sessionStorage.getItem("fl_pv");
      if (prev) {
        const sep = prev.lastIndexOf("|");
        const prevPath = prev.slice(0, sep);
        const prevAt = Number(prev.slice(sep + 1));
        if (prevPath === pathname && now - prevAt < 1500) return;
      }
      sessionStorage.setItem("fl_pv", `${pathname}|${now}`);
    } catch {
      if (last.current === pathname) return;
    }
    last.current = pathname;

    void fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
