import { getServerSupabase } from "@/lib/supabase";
import { isNextProductionBuild } from "@/lib/next-build";
import { isCacheOnlyDataRuntime } from "@/lib/worker-runtime";
import {
  fetchWcNewsItems,
  type NewsCategory,
  type WcNewsItem,
} from "@/lib/wc/news-feeds";

const CACHE_ID = "global";
const CACHE_MS = 20 * 60 * 1000;

function cacheHasPlNews(items: WcNewsItem[]): boolean {
  return items.some((i) => i.feed_id === "pl-official");
}

let memCache: { at: number; items: WcNewsItem[]; fetched_at: string } | null =
  null;

function normalizeItem(raw: WcNewsItem): WcNewsItem {
  return {
    ...raw,
    image_url: raw.image_url ?? null,
    category: raw.category ?? "trending",
  };
}

function filterItems(
  items: WcNewsItem[],
  opts: {
    editorialOnly: boolean;
    limit: number;
    category?: NewsCategory | "ALL";
  },
): WcNewsItem[] {
  let out = items.map(normalizeItem);
  if (opts.category && opts.category !== "ALL") {
    if (opts.category === "trending") {
      out = [...out].sort((a, b) => {
        const ta = a.published_at ? Date.parse(a.published_at) : 0;
        const tb = b.published_at ? Date.parse(b.published_at) : 0;
        return tb - ta;
      });
    } else {
      out = out.filter((i) => i.category === opts.category);
    }
  }
  if (opts.editorialOnly) out = out.filter((i) => i.editorial_score >= 2);
  return out.slice(0, opts.limit);
}

export async function loadWcNewsFromDb(): Promise<{
  items: WcNewsItem[];
  fetched_at: string | null;
}> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("wc_news_cache")
      .select("items, fetched_at")
      .eq("id", CACHE_ID)
      .maybeSingle();
    if (error || !data) return { items: [], fetched_at: null };
    const items = ((data.items as WcNewsItem[]) ?? []).map(normalizeItem);
    return {
      items,
      fetched_at: (data.fetched_at as string | null) ?? null,
    };
  } catch {
    return { items: [], fetched_at: null };
  }
}

export async function saveWcNewsToDb(items: WcNewsItem[]): Promise<string> {
  const supa = getServerSupabase();
  const fetched_at = new Date().toISOString();
  const { error } = await supa.from("wc_news_cache").upsert({
    id: CACHE_ID,
    items,
    fetched_at,
  });
  if (error) throw new Error(error.message);
  return fetched_at;
}

export async function syncWcNews(): Promise<{
  count: number;
  fpl_x_count: number;
  fetched_at: string;
}> {
  const items = await fetchWcNewsItems({ limit: 150, editorialOnly: false });
  const fetched_at = await saveWcNewsToDb(items);
  memCache = { at: Date.now(), items, fetched_at };
  const fpl_x_count = items.filter((i) => i.feed_id === "fpl-x").length;
  return { count: items.length, fpl_x_count, fetched_at };
}

export async function getWcNewsForApi(opts?: {
  limit?: number;
  editorialOnly?: boolean;
  refresh?: boolean;
  category?: NewsCategory | "ALL";
}): Promise<{
  items: WcNewsItem[];
  cached: boolean;
  fetched_at: string;
  source: "memory" | "database" | "live";
}> {
  const editorialOnly = opts?.editorialOnly ?? false;
  const limit = Math.min(150, Math.max(10, opts?.limit ?? 100));
  const category = opts?.category ?? "ALL";
  const filterOpts = { editorialOnly, limit, category };
  const now = Date.now();

  if (!opts?.refresh && memCache && now - memCache.at < CACHE_MS) {
    if (cacheHasPlNews(memCache.items)) {
      return {
        items: filterItems(memCache.items, filterOpts),
        cached: true,
        fetched_at: memCache.fetched_at,
        source: "memory",
      };
    }
  }

  if (!opts?.refresh) {
    const db = await loadWcNewsFromDb();
    if (db.items.length > 0 && db.fetched_at) {
      const dbAge = now - Date.parse(db.fetched_at);
      if (dbAge < CACHE_MS && cacheHasPlNews(db.items)) {
        memCache = { at: now, items: db.items, fetched_at: db.fetched_at };
        return {
          items: filterItems(db.items, filterOpts),
          cached: true,
          fetched_at: db.fetched_at,
          source: "database",
        };
      }
    }
  }

  // Build + production Workers: DB/cache only (live RSS via sync-news cron).
  if ((isNextProductionBuild() || isCacheOnlyDataRuntime()) && !opts?.refresh) {
    const db = await loadWcNewsFromDb();
    const items = db.items.length > 0 ? db.items : memCache?.items ?? [];
    const fetched_at =
      db.fetched_at ?? memCache?.fetched_at ?? new Date().toISOString();
    if (items.length > 0) {
      memCache = { at: now, items, fetched_at };
    }
    return {
      items: filterItems(items, filterOpts),
      cached: true,
      fetched_at,
      source: "database",
    };
  }

  let items: WcNewsItem[] = [];
  let fetched_at = new Date().toISOString();
  let source: "live" | "database" = "live";

  try {
    items = await fetchWcNewsItems({ limit: 150, editorialOnly: false });
    if (items.length > 0) {
      fetched_at = await saveWcNewsToDb(items);
    }
  } catch {
    items = [];
  }

  if (items.length === 0) {
    const db = await loadWcNewsFromDb();
    if (db.items.length > 0 && db.fetched_at) {
      items = db.items;
      fetched_at = db.fetched_at;
      source = "database";
    }
  }

  if (items.length > 0) {
    memCache = { at: now, items, fetched_at };
  }

  return {
    items: filterItems(items, filterOpts),
    cached: source !== "live",
    fetched_at,
    source,
  };
}
