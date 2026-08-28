import { Redis } from "@upstash/redis";
import {
  shanghaiDateIso,
  shanghaiYesterdayIso,
} from "@/lib/fpl/wechat-daily-card";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id. */
export type PriceSnapshot = Record<number, number>;

type DayFeed = {
  /** Player id → delta in tenths of £m vs that day's opening snapshot. */
  deltas: Record<string, number>;
};

const TTL_SEC = 8 * 24 * 60 * 60;

const memoryOpen = new Map<string, PriceSnapshot>();
const memoryClose = new Map<string, PriceSnapshot>();
const memoryFeed = new Map<string, DayFeed>();

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function openKey(date: string): string {
  return `fpl:price-open-v3:${date}`;
}

function closeKey(date: string): string {
  return `fpl:price-close-v3:${date}`;
}

function feedKey(date: string): string {
  return `fpl:price-feed-v3:${date}`;
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

/** First observation of a Shanghai calendar day — pre-change baseline when captured early. */
async function ensureOpenSnapshot(
  date: string,
  prices: PriceSnapshot,
): Promise<void> {
  const key = openKey(date);
  if (memoryOpen.has(key)) return;

  const r = redis();
  if (r) {
    const created = await r.setnx(key, prices);
    if (created) await r.expire(key, TTL_SEC);
    if (created) memoryOpen.set(key, prices);
    return;
  }

  if (!memoryOpen.has(key)) {
    memoryOpen.set(key, prices);
  }
}

async function loadFeed(date: string): Promise<DayFeed | null> {
  const key = feedKey(date);
  const mem = memoryFeed.get(key);
  if (mem) return mem;
  const r = redis();
  if (!r) return null;
  const raw = asFeed(await r.get(key));
  if (raw) memoryFeed.set(key, raw);
  return raw;
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

function pickBaseline(
  current: PriceSnapshot,
  open: PriceSnapshot | null,
  yesterdayClose: PriceSnapshot | null,
): PriceSnapshot | null {
  if (open && Object.keys(open).length > 0) {
    const vsOpen = computeDeltas(current, open);
    if (vsOpen.size > 0) return open;
    // Open may have been captured after today's window — try yesterday close.
  }
  if (yesterdayClose && Object.keys(yesterdayClose).length > 0) {
    return yesterdayClose;
  }
  return open;
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
 * Today's price movers only (Asia/Shanghai calendar day).
 *
 * Compare live prices to this morning's opening snapshot (first request of the
 * day), falling back to yesterday's closing prices when the open was captured
 * too late. Persist the detected set under today's date so it stays visible
 * for the rest of the day. A new calendar day starts empty until today's price
 * window — yesterday's list is never carried over.
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
): Promise<Map<number, number>> {
  const today = shanghaiDateIso();
  const yesterday = shanghaiYesterdayIso();

  await Promise.all([
    ensureOpenSnapshot(today, current),
    saveSnapshot(memoryClose, closeKey(today), current),
  ]);

  const [todayOpen, yesterdayClose] = await Promise.all([
    loadSnapshot(memoryOpen, openKey(today)),
    loadSnapshot(memoryClose, closeKey(yesterday)),
  ]);

  const baseline = pickBaseline(current, todayOpen, yesterdayClose);
  if (baseline) {
    const fresh = computeDeltas(current, baseline);
    if (fresh.size > 0) {
      await saveFeed(today, fresh);
      return fresh;
    }
  }

  // Same-day sticky feed only — never reuse yesterday's movers.
  return feedToMap(await loadFeed(today));
}
