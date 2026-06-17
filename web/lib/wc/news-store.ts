import { getServerSupabase } from "@/lib/supabase";
import { fetchWcNewsItems, type WcNewsItem } from "@/lib/wc/news-feeds";

const CACHE_ID = "global";
const CACHE_MS = 20 * 60 * 1000;

let memCache: { at: number; items: WcNewsItem[]; fetched_at: string } | null =
  null;

function filterItems(
  items: WcNewsItem[],
  editorialOnly: boolean,
  limit: number,
): WcNewsItem[] {
  let out = items;
  if (editorialOnly) out = out.filter((i) => i.editorial_score >= 2);
  return out.slice(0, limit);
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
    return {
      items: (data.items as WcNewsItem[]) ?? [],
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
  fetched_at: string;
}> {
  const items = await fetchWcNewsItems({ limit: 150, editorialOnly: false });
  const fetched_at = await saveWcNewsToDb(items);
  memCache = { at: Date.now(), items, fetched_at };
  return { count: items.length, fetched_at };
}

export async function getWcNewsForApi(opts?: {
  limit?: number;
  editorialOnly?: boolean;
  refresh?: boolean;
}): Promise<{
  items: WcNewsItem[];
  cached: boolean;
  fetched_at: string;
  source: "memory" | "database" | "live";
}> {
  const editorialOnly = opts?.editorialOnly ?? false;
  const limit = Math.min(150, Math.max(10, opts?.limit ?? 100));
  const now = Date.now();

  if (!opts?.refresh && memCache && now - memCache.at < CACHE_MS) {
    return {
      items: filterItems(memCache.items, editorialOnly, limit),
      cached: true,
      fetched_at: memCache.fetched_at,
      source: "memory",
    };
  }

  if (!opts?.refresh) {
    const db = await loadWcNewsFromDb();
    if (db.items.length > 0 && db.fetched_at) {
      const dbAge = now - Date.parse(db.fetched_at);
      if (dbAge < CACHE_MS) {
        memCache = { at: now, items: db.items, fetched_at: db.fetched_at };
        return {
          items: filterItems(db.items, editorialOnly, limit),
          cached: true,
          fetched_at: db.fetched_at,
          source: "database",
        };
      }
    }
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
    items: filterItems(items, editorialOnly, limit),
    cached: source !== "live",
    fetched_at,
    source,
  };
}
