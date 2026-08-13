import { NextResponse } from "next/server";
import { getClientIp, getNamedRateLimiter } from "@/lib/ratelimit";

export const HISTORICAL_API_VERSION = "historical-v1.0.0";

/** Public endpoints: light traffic, CDN-friendly. */
export const PUBLIC_CACHE =
  "public, s-maxage=300, stale-while-revalidate=600";

/** Partner endpoints: short private cache only. */
export const PRIVATE_CACHE = "private, max-age=60";

export function historicalJson(
  body: unknown,
  init?: { status?: number; cacheControl?: string },
) {
  const headers = new Headers();
  headers.set("X-Historical-API-Version", HISTORICAL_API_VERSION);
  if (init?.cacheControl) {
    headers.set("Cache-Control", init.cacheControl);
  }
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers,
  });
}

/**
 * Soft IP rate limit when Upstash is configured.
 * Returns a 429 response if exceeded, otherwise null.
 */
export async function enforceHistoricalRateLimit(
  req: Request,
  opts: { bucket: string; limit: number; window: `${number} ${"s" | "m" | "h"}` },
): Promise<NextResponse | null> {
  const limiter = getNamedRateLimiter({
    prefix: `fpl-llm/historical/${opts.bucket}`,
    limit: opts.limit,
    window: opts.window,
  });
  if (!limiter) return null;

  const ip = getClientIp(req);
  const result = await limiter.limit(ip);
  if (result.success) return null;

  return historicalJson(
    {
      error: "Rate limit exceeded. Try again shortly.",
      retryAfterMs: Math.max(0, result.reset - Date.now()),
    },
    { status: 429, cacheControl: "no-store" },
  );
}
