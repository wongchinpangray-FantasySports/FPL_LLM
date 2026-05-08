import { unstable_cache } from "next/cache";
import { fplGet } from "@/lib/fpl";

/** Trimmed bootstrap payload — only what Manager benchmarks need (smaller cache entry). */
export type CachedBootstrapEvents = {
  events: Array<{
    id: number;
    average_entry_score?: number;
  }>;
};

/** Single-flight cached bootstrap for GW averages (~large JSON); safe to share across requests. */
async function fetchBootstrapEventAverages(): Promise<CachedBootstrapEvents> {
  const raw = await fplGet<{ events?: CachedBootstrapEvents["events"] }>(
    "/bootstrap-static/",
  );
  return {
    events:
      raw.events?.map((e) => ({
        id: e.id,
        average_entry_score: e.average_entry_score,
      })) ?? [],
  };
}

/**
 * FPL `bootstrap-static` per GW averages — cached ~5 minutes (ISR).
 * Reduces bandwidth vs fetching the full bootstrap on every Manager page load.
 */
export const getCachedBootstrapEventAverages = unstable_cache(
  fetchBootstrapEventAverages,
  ["fpl-bootstrap-event-averages"],
  { revalidate: 300 },
);
