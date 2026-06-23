import type { WcNewsItem } from "@/lib/wc/news-feeds";

const STORAGE_PREFIX = "fpl-llm-news-page:";
const CACHE_VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type NewsPageCachePayload = {
  v: number;
  items: WcNewsItem[];
  total: number;
  category?: string;
  disclaimer: string;
  fetched_at?: string;
  saved_at: string;
};

export function newsPageCacheKey(
  category: string,
  region: string,
  editorialOnly: boolean,
): string {
  return `${STORAGE_PREFIX}${category}:${region}:${editorialOnly ? "1" : "0"}`;
}

export function readNewsPageCache(key: string): NewsPageCachePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsPageCachePayload;
    if (parsed.v !== CACHE_VERSION || !Array.isArray(parsed.items)) return null;
    const age = Date.now() - Date.parse(parsed.saved_at);
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeNewsPageCache(
  key: string,
  payload: Omit<NewsPageCachePayload, "v" | "saved_at">,
): void {
  if (typeof window === "undefined") return;
  try {
    const entry: NewsPageCachePayload = {
      ...payload,
      v: CACHE_VERSION,
      saved_at: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota or private mode — ignore.
  }
}
