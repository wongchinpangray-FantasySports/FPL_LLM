"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetch server data so same-day friendly results can appear without a manual reload. */
export function PreseasonAutoRefresh({
  intervalMs = 3 * 60 * 1000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => router.refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
