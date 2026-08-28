import { Redis } from "@upstash/redis";
import {
  shanghaiDateIso,
  shanghaiYesterdayIso,
} from "@/lib/fpl/wechat-daily-card";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id. */
export type PriceSnapshot = Record<string, number>;

type DayFeed = {
  deltas: Record<string, number>;
};

/** Compact snapshot: [[id, costTenths], ...] — much smaller than a keyed object. */
type CompactSnapshot = [number, number][];

const TTL_SEC = 10 * 24 * 60 * 60;
const CLOSE_WRITE_MIN_MS = 30 * 60 * 1000;

const memoryOpen = new Map<string, PriceSnapshot>();
const memoryClose = new Map<string, PriceSnapshot>();
const memoryFeed = new Map<string, DayFeed>();
let lastCloseWriteAt = 0;

function redis(): Redis | null {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

function openKey(date: string): string {
  return `fpl:px-open-v5:${date}`;
}

function closeKey(date: string): string {
  return `fpl:px-close-v5:${date}`;
}

function closeKeyLegacy(date: string): string {
  return `fpl:price-close-v4:${date}`;
}

function feedKey(date: string): string {
  return `fpl:px-feed-v5:${date}`;
}

function feedKeyLegacy(date: string): string {
  return `fpl:price-feed-v4:${date}`;
}

function toCompact(snapshot: PriceSnapshot): CompactSnapshot {
  const out: CompactSnapshot = [];
  for (const [id, cost] of Object.entries(snapshot)) {
    const n = Number(id);
    if (Number.isFinite(n) && Number.isFinite(cost)) out.push([n, cost]);
  }
  return out;
}

function fromCompact(raw: unknown): PriceSnapshot | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const out: PriceSnapshot = {};
    for (const row of raw) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const id = Number(row[0]);
      const cost = Number(row[1]);
      if (!Number.isFinite(id) || !Number.isFinite(cost)) continue;
      out[String(id)] = cost;
    }
    return Object.keys(out).length ? out : null;
  }
  if (typeof raw === "object") {
    const out: PriceSnapshot = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const cost = Number(v);
      if (!Number.isFinite(cost)) continue;
      out[String(k)] = cost;
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

function asFeed(raw: unknown): DayFeed | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as DayFeed;
  if (typeof row.deltas !== "object" || !row.deltas) return null;
  return row;
}

async function loadSnapshot(
  store: Map<string, PriceSnapshot>,
  key: string,
): Promise<PriceSnapshot | null> {
  const mem = store.get(key);
  if (mem) return mem;
  const r = redis();
  if (!r) return null;
  try {
    const raw = fromCompact(await r.get(key));
    if (raw) store.set(key, raw);
    return raw;
  } catch {
    return null;
  }
}

async function saveSnapshot(
  store: Map<string, PriceSnapshot>,
  key: string,
  prices: PriceSnapshot,
): Promise<void> {
  store.set(key, prices);
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, toCompact(prices), { ex: TTL_SEC });
  } catch {
    /* ignore — never take down the Worker for Redis */
  }
}

/** First observation of a Shanghai day — prefer yesterday close as pre-window baseline. */
async function ensureOpenSnapshot(
  date: string,
  prices: PriceSnapshot,
): Promise<PriceSnapshot> {
  const key = openKey(date);
  const existing = await loadSnapshot(memoryOpen, key);
  if (existing) return existing;

  const yClose = await loadSnapshot(
    memoryClose,
    closeKey(shanghaiYesterdayIso()),
  );
  const seed =
    yClose && Object.keys(yClose).length > 0 ? yClose : prices;

  const r = redis();
  if (r) {
    try {
      const created = await r.set(key, toCompact(seed), {
        nx: true,
        ex: TTL_SEC,
      });
      if (created) {
        memoryOpen.set(key, seed);
        return seed;
      }
      const after = await loadSnapshot(memoryOpen, key);
      if (after) return after;
    } catch {
      /* fall through */
    }
  }

  memoryOpen.set(key, seed);
  return seed;
}

async function loadFeed(date: string): Promise<Map<number, number>> {
  for (const key of [feedKey(date), feedKeyLegacy(date)]) {
    const mem = memoryFeed.get(key);
    if (mem) {
      const mapped = feedToMap(mem);
      if (mapped.size > 0) return mapped;
    }
    const r = redis();
    if (!r) continue;
    try {
      const raw = asFeed(await r.get(key));
      if (raw) memoryFeed.set(key, raw);
      const mapped = feedToMap(raw);
      if (mapped.size > 0) return mapped;
    } catch {
      /* try next */
    }
  }
  return new Map();
}

async function saveFeed(date: string, deltas: Map<number, number>): Promise<void> {
  const feed: DayFeed = { deltas: mapToRecord(deltas) };
  const key = feedKey(date);
  memoryFeed.set(key, feed);
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, feed, { ex: TTL_SEC });
  } catch {
    /* ignore */
  }
}

function computeDeltas(
  current: PriceSnapshot,
  baseline: PriceSnapshot,
): Map<number, number> {
  const deltas = new Map<number, number>();
  for (const [idStr, nowTenths] of Object.entries(current)) {
    const prev = baseline[idStr];
    if (prev == null || !Number.isFinite(prev)) continue;
    const deltaTenths = nowTenths - prev;
    if (deltaTenths !== 0) deltas.set(Number(idStr), deltaTenths);
  }
  return deltas;
}

function feedToMap(feed: DayFeed | null): Map<number, number> {
  const out = new Map<number, number>();
  if (!feed) return out;
  for (const [idStr, delta] of Object.entries(feed.deltas)) {
    const id = Number(idStr);
    const n = Number(delta);
    if (!Number.isFinite(id) || !Number.isFinite(n) || n === 0) continue;
    out.set(id, n);
  }
  return out;
}

function mapToRecord(deltas: Map<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, delta] of deltas) out[String(id)] = delta;
  return out;
}

function mergeDeltas(
  base: Map<number, number>,
  extra: Map<number, number>,
): Map<number, number> {
  const out = new Map(base);
  for (const [id, delta] of extra) {
    if (delta === 0) out.delete(id);
    else out.set(id, delta);
  }
  return out;
}

export function priceMapFromBootstrap(
  elements: { id: number; now_cost?: number }[],
): PriceSnapshot {
  const out: PriceSnapshot = {};
  for (const el of elements) {
    const cost = Number(el.now_cost);
    if (Number.isFinite(cost)) out[String(el.id)] = cost;
  }
  return out;
}

/**
 * Today's price movers for the home sidebar (Asia/Shanghai date).
 *
 * Lightweight Redis I/O: one compact open snapshot (set-once), a small sticky
 * feed, and throttled close writes. Failures never throw — Worker stays up.
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
): Promise<Map<number, number>> {
  try {
    const today = shanghaiDateIso();
    const yesterday = shanghaiYesterdayIso();

    const [sticky, yesterdayClose] = await Promise.all([
      loadFeed(today),
      loadSnapshot(memoryClose, closeKey(yesterday)).then(
        async (v) =>
          v ?? (await loadSnapshot(memoryClose, closeKeyLegacy(yesterday))),
      ),
    ]);

    let open = await ensureOpenSnapshot(today, current);

    // Repair late open capture: if open matches live but yesterday close differs,
    // reopen from yesterday close so today's movers reappear.
    if (
      yesterdayClose &&
      computeDeltas(current, open).size === 0 &&
      computeDeltas(current, yesterdayClose).size > 0
    ) {
      await saveSnapshot(memoryOpen, openKey(today), yesterdayClose);
      open = yesterdayClose;
    }

    let feed = new Map(sticky);
    const fresh = computeDeltas(current, open);
    if (fresh.size > 0) {
      feed = mergeDeltas(feed, fresh);
      await saveFeed(today, feed);
    }

    // Throttle close writes — once per 30m is enough for tomorrow's baseline.
    const now = Date.now();
    if (now - lastCloseWriteAt >= CLOSE_WRITE_MIN_MS) {
      lastCloseWriteAt = now;
      void saveSnapshot(memoryClose, closeKey(today), current);
    }

    return feed;
  } catch {
    return new Map();
  }
}
