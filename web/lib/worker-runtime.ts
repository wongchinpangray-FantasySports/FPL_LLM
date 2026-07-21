import { isNextProductionBuild } from "@/lib/next-build";

/**
 * Production Workers should read Supabase/cron caches — not live FIFA/RSS/FPL fan-out.
 * Dev (`next dev`) still allows live fetches for debugging.
 */
export function isCacheOnlyDataRuntime(): boolean {
  if (isNextProductionBuild()) return true;
  return process.env.NODE_ENV === "production";
}
