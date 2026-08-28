import { Redis } from "@upstash/redis";
import {
  shanghaiDateIso,
  shanghaiYesterdayIso,
} from "@/lib/fpl/wechat-daily-card";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id. */
export type PriceSnapshot = Record<number, number>;

type DayFeed = {
  deltas: Record<string, number>;
};

const TTL_SEC = 10 * 24 * 60 * 60;
const LAST_SEEN_KEY = "fpl:price-last-seen-v4";
const LAST_SEEN_LEGACY = "fpl:price-seen-v2";

const memoryOpen = new Map<string, PriceSnapshot>();
const memoryClose = new Map<string, PriceSnapshot>();
const memoryFeed = new Map<string, DayFeed>();
let memoryLastSeen: PriceSnapshot | null = null;

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function openKey(date: string): string {
  return `fpl:price-open-v4:${date}`;
}

function closeKey(date: string): string {
  return `fpl:price-close-v4:${date}`;
}

function closeKeyLegacy(date: string): string {
  return `fpl:price-close-v3:${date}`;
}

function feedKeyLegacy(date: string): string {
  return `fpl:price-feed-v3:${date}`;
}

function feedKey(date: string): string {
  return `fpl:price-feed-v4:${date}`;
}

function asSnapshot(raw: unknown): PriceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PriceSnapshot;
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
  const raw = asSnapshot(await r.get(key));
  if (raw) store.set(key, raw);
  return raw;
}

async function saveSnapshot(
  store: Map<string, PriceSnapshot>,
  key: string,
  prices: PriceSnapshot,
): Promise<void> {
  store.set(key, prices);
  const r = redis();
  if (!r) return;
  await r.set(key, prices, { ex: TTL_SEC });
}

async function loadLastSeen(): Promise<PriceSnapshot | null> {
  if (memoryLastSeen) return memoryLastSeen;
  const r = redis();
  if (!r) return null;
  const raw =
    asSnapshot(await r.get(LAST_SEEN_KEY)) ??
    asSnapshot(await r.get(LAST_SEEN_LEGACY));
  if (raw) memoryLastSeen = raw;
  return raw;
}

async function saveLastSeen(prices: PriceSnapshot): Promise<void> {
  memoryLastSeen = prices;
  const r = redis();
  if (!r) return;
  await r.set(LAST_SEEN_KEY, prices, { ex: TTL_SEC });
}

async function loadYesterdayClose(
  yesterday: string,
): Promise<PriceSnapshot | null> {
  return (
    (await loadSnapshot(memoryClose, closeKey(yesterday))) ??
    (await loadSnapshot(memoryClose, closeKeyLegacy(yesterday)))
  );
}

/** First observation of a Shanghai calendar day — baseline for today's movers. */
async function ensureOpenSnapshot(
  date: string,
  prices: PriceSnapshot,
): Promise<void> {
  const key = openKey(date);
  if (memoryOpen.has(key)) return;

  const r = redis();
  if (r) {
    const existing = asSnapshot(await r.get(key));
    if (existing) {
      memoryOpen.set(key, existing);
      return;
    }
  }

  const yClose = await loadYesterdayClose(shanghaiYesterdayIso());
  const seed =
    yClose && Object.keys(yClose).length > 0 ? yClose : prices;

  if (r) {
    const created = await r.setnx(key, seed);
    if (created) await r.expire(key, TTL_SEC);
    if (created) memoryOpen.set(key, seed);
    return;
  }

  if (!memoryOpen.has(key)) {
    memoryOpen.set(key, seed);
  }
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
    const raw = asFeed(await r.get(key));
    if (raw) memoryFeed.set(key, raw);
    const mapped = feedToMap(raw);
    if (mapped.size > 0) return mapped;
  }
  return new Map();
}

async function saveFeed(date: string, deltas: Map<number, number>): Promise<void> {
  const feed: DayFeed = { deltas: mapToRecord(deltas) };
  const key = feedKey(date);
  memoryFeed.set(key, feed);
  const r = redis();
  if (!r) return;
  await r.set(key, feed, { ex: TTL_SEC });
}

function computeDeltas(
  current: PriceSnapshot,
  baseline: PriceSnapshot,
): Map<number, number> {
  const deltas = new Map<number, number>();
  for (const [idStr, nowTenths] of Object.entries(current)) {
    const id = Number(idStr);
    const prev = baseline[id];
    if (prev == null || !Number.isFinite(prev)) continue;
    const deltaTenths = nowTenths - prev;
    if (deltaTenths !== 0) deltas.set(id, deltaTenths);
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

function pickDayBaseline(
  current: PriceSnapshot,
  todayOpen: PriceSnapshot | null,
  yesterdayClose: PriceSnapshot | null,
): PriceSnapshot | null {
  if (todayOpen && Object.keys(todayOpen).length > 0) {
    if (computeDeltas(current, todayOpen).size > 0) return todayOpen;
  }
  if (yesterdayClose && Object.keys(yesterdayClose).length > 0) {
    return yesterdayClose;
  }
  return todayOpen;
}

export function priceMapFromBootstrap(
  elements: { id: number; now_cost?: number }[],
): PriceSnapshot {
  const out: PriceSnapshot = {};
  for (const el of elements) {
    const cost = Number(el.now_cost);
    if (Number.isFinite(cost)) out[el.id] = cost;
  }
  return out;
}

/**
 * Today's price movers for the home sidebar (Asia/Shanghai date).
 *
 * - Detect moves vs today's open snapshot, yesterday's close, or last-seen prices.
 * - Merge into a date-keyed sticky feed so the list stays until tomorrow.
 * - Never surface yesterday's feed on a new calendar day.
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
): Promise<Map<number, number>> {
  const today = shanghaiDateIso();
  const yesterday = shanghaiYesterdayIso();

  const [lastSeen, todayOpenRaw, yesterdayClose, sticky] = await Promise.all([
    loadLastSeen(),
    loadSnapshot(memoryOpen, openKey(today)),
    loadYesterdayClose(yesterday),
    loadFeed(today),
  ]);

  await ensureOpenSnapshot(today, current);

  let todayOpen =
    (await loadSnapshot(memoryOpen, openKey(today))) ?? todayOpenRaw;

  // Repair when today's open was captured after the price window (open == current).
  if (
    todayOpen &&
    yesterdayClose &&
    computeDeltas(current, todayOpen).size === 0 &&
    computeDeltas(current, yesterdayClose).size > 0
  ) {
    await saveSnapshot(memoryOpen, openKey(today), yesterdayClose);
    todayOpen = yesterdayClose;
  }

  let feed = new Map(sticky);
  const detected = new Map<number, number>();

  const dayBaseline = pickDayBaseline(current, todayOpen, yesterdayClose);
  if (dayBaseline) {
    for (const [id, delta] of computeDeltas(current, dayBaseline)) {
      detected.set(id, delta);
    }
  }

  // Fallback when day baseline missed (e.g. late deploy) and nothing sticky yet.
  if (detected.size === 0 && feed.size === 0 && lastSeen) {
    for (const [id, delta] of computeDeltas(current, lastSeen)) {
      detected.set(id, delta);
    }
  }

  if (detected.size > 0) {
    feed = mergeDeltas(feed, detected);
    await saveFeed(today, feed);
  }

  await Promise.all([
    saveSnapshot(memoryClose, closeKey(today), current),
    saveLastSeen(current),
  ]);

  return feed;
}
