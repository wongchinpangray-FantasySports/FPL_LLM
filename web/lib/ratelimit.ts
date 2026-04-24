import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _ratelimit: Ratelimit | null = null;
let _disabled = false;

/**
 * Returns a rate limiter if Upstash env vars are configured, else null.
 * 20 requests / minute / IP is a reasonable default for a chat endpoint.
 */
export function getRateLimiter(): Ratelimit | null {
  if (_ratelimit) return _ratelimit;
  if (_disabled) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _disabled = true;
    return null;
  }
  _ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    analytics: true,
    prefix: "fpl-llm/chat",
  });
  return _ratelimit;
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}
