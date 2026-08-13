import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _chatRatelimit: Ratelimit | null = null;
let _chatDisabled = false;
const _named = new Map<string, Ratelimit | null>();
let _redisUnavailable = false;

function getRedis(): Redis | null {
  if (_redisUnavailable) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _redisUnavailable = true;
    return null;
  }
  try {
    return new Redis({ url, token });
  } catch {
    _redisUnavailable = true;
    return null;
  }
}

/**
 * Returns a rate limiter if Upstash env vars are configured, else null.
 * 20 requests / minute / IP is a reasonable default for a chat endpoint.
 */
export function getRateLimiter(): Ratelimit | null {
  if (_chatRatelimit) return _chatRatelimit;
  if (_chatDisabled) return null;
  const limiter = getNamedRateLimiter({
    prefix: "fpl-llm/chat",
    limit: 20,
    window: "1 m",
  });
  if (!limiter) {
    _chatDisabled = true;
    return null;
  }
  _chatRatelimit = limiter;
  return _chatRatelimit;
}

/**
 * Named sliding-window limiter (cached by prefix+limit+window).
 * Returns null when Upstash is not configured.
 */
export function getNamedRateLimiter(opts: {
  prefix: string;
  limit: number;
  window: `${number} ${"s" | "m" | "h"}`;
}): Ratelimit | null {
  const key = `${opts.prefix}|${opts.limit}|${opts.window}`;
  if (_named.has(key)) return _named.get(key) ?? null;

  const redis = getRedis();
  if (!redis) {
    _named.set(key, null);
    return null;
  }
  try {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(opts.limit, opts.window),
      analytics: true,
      prefix: opts.prefix,
    });
    _named.set(key, limiter);
    return limiter;
  } catch {
    _named.set(key, null);
    return null;
  }
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anon"
  );
}
