import { getServerSupabase } from "@/lib/supabase";
import { sanitizeUtf16 } from "@/lib/utf16-safe";
import type { SiteFeature } from "@/lib/analytics/types";

export const SITE_VISITOR_COOKIE = "fl_site_vid";
export const SCOUT_VISITOR_COOKIE = "fl_scout_vid";
export const SITE_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSiteVisitorId(value: string | undefined | null): value is string {
  if (!value) return false;
  if (UUID_RE.test(value)) return true;
  return value.length >= 8 && value.length <= 80;
}

export function isMissingSiteEventsTable(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

let tableMissingCached = false;

export async function insertSitePageview(input: {
  path: string;
  feature: SiteFeature;
  visitor_id: string | null;
  user_id: string | null;
  referrer: string | null;
}): Promise<{ ok: boolean; tableMissing: boolean }> {
  if (tableMissingCached) return { ok: false, tableMissing: true };
  const supa = getServerSupabase();
  const { error } = await supa.from("site_events").insert({
    event_type: "pageview",
    path: sanitizeUtf16(input.path).slice(0, 300),
    feature: input.feature,
    visitor_id: input.visitor_id,
    user_id: input.user_id,
    referrer: input.referrer
      ? sanitizeUtf16(input.referrer).slice(0, 500)
      : null,
  });
  if (!error) return { ok: true, tableMissing: false };
  if (isMissingSiteEventsTable(error)) {
    tableMissingCached = true;
    return { ok: false, tableMissing: true };
  }
  throw new Error(error.message);
}
