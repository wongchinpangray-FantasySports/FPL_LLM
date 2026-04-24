"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useEntryId } from "./entry-id-context";

/**
 * Syncs `?entry=1234567` into the same storage as the Home form. Each Vercel
 * preview URL is a different origin, so localStorage does not carry over;
 * a bookmark like `/chat?entry=123` restores the ID on that host.
 */
export function EntryIdQuerySync() {
  const sp = useSearchParams();
  const { setEntryId } = useEntryId();

  useEffect(() => {
    const e = sp.get("entry");
    if (e && /^\d+$/.test(e)) {
      setEntryId(e);
    }
  }, [sp, setEntryId]);

  return null;
}
