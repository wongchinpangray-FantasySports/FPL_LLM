import { Redis } from "@upstash/redis";
import { shanghaiDateIso } from "@/lib/fpl/wechat-daily-card";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id. */
export type PriceSnapshot = Record<number, number>;

type StickyFeed = {
  /** Shanghai date when these moves were last detected. */
  date: string;
  /** Player id → delta in tenths of £m. */
  deltas: Record<string, number>;
};

const TTL_SEC = 14 * 24 * 60 * 60;
const SEEN_KEY = "fpl:price-seen-v2";
const FEED_KEY = "fpl:price-daily-feed-v2";

const memorySeen = new Map<string, PriceSnapshot>();
const memoryFeed = new Map<string, StickyFeed>();

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function asSnapshot(raw: unknown): PriceSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as PriceSnapshot;
}

function asFeed(raw: unknown): StickyFeed | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as StickyFeed;
  if (!row.date || typeof row.deltas !== "object" || !row.deltas) return null;
  return row;
}

async function loadSeen(): Promise<PriceSnapshot | null> {
  const mem = memorySeen.get(SEEN_KEY);
  if (mem) return mem;
  const r = redis();
  if (!r) return null;
  const raw = asSnapshot(await r.get(SEEN_KEY));
  if (raw) memorySeen.set(SEEN_KEY, raw);
  return raw;
}

async function saveSeen(prices: PriceSnapshot): Promise<void> {
  memorySeen.set(SEEN_KEY, prices);
  const r = redis();
  if (!r) return;
  await r.set(SEEN_KEY, prices, { ex: TTL_SEC });
}

async function loadFeed(): Promise<StickyFeed | null> {
  const mem = memoryFeed.get(FEED_KEY);
  if (mem) return mem;
  const r = redis();
  if (!r) return null;
  const raw = asFeed(await r.get(FEED_KEY));
  if (raw) memoryFeed.set(FEED_KEY, raw);
  return raw;
}

async function saveFeed(feed: StickyFeed): Promise<void> {
  memoryFeed.set(FEED_KEY, feed);
  const r = redis();
  if (!r) return;
  await r.set(FEED_KEY, feed, { ex: TTL_SEC });
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

function feedToMap(feed: StickyFeed | null): Map<number, number> {
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

export function eventDeltaMapFromBootstrap(
  elements: { id: number; cost_change_event?: number }[],
): Map<number, number> {
  const out = new Map<number, number>();
  for (const el of elements) {
    const delta = Number(el.cost_change_event);
    if (!Number.isFinite(delta) || delta === 0) continue;
    out.set(el.id, delta);
  }
  return out;
}

/**
 * Sticky daily price deltas for the home sidebar.
 *
 * When live prices move vs the last-seen snapshot, replace the feed with those
 * movers and stamp today's Shanghai date. Until the next non-zero move set
 * arrives, keep returning the previous feed (so today's rises/falls stay
 * visible overnight and into the next morning).
 *
 * If the feed is empty (e.g. first deploy after prices already moved), seed once
 * from FPL `cost_change_event` so the sidebar is not blank; the next real price
 * window replaces that seed with true day-to-day deltas.
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
  eventSeed?: Map<number, number>,
): Promise<Map<number, number>> {
  const today = shanghaiDateIso();
  const [seen, feed] = await Promise.all([loadSeen(), loadFeed()]);

  if (!seen) {
    await saveSeen(current);
    if (feed && Object.keys(feed.deltas).length > 0) {
      return feedToMap(feed);
    }
    if (eventSeed && eventSeed.size > 0) {
      const seeded: StickyFeed = {
        date: today,
        deltas: mapToRecord(eventSeed),
      };
      await saveFeed(seeded);
      return new Map(eventSeed);
    }
    return new Map();
  }

  const fresh = computeDeltas(current, seen);
  if (fresh.size > 0) {
    const next: StickyFeed = {
      date: today,
      deltas: mapToRecord(fresh),
    };
    await Promise.all([saveFeed(next), saveSeen(current)]);
    return fresh;
  }

  // No new moves — keep last-seen in sync and keep showing the sticky feed.
  await saveSeen(current);

  if (feed && Object.keys(feed.deltas).length > 0) {
    return feedToMap(feed);
  }

  // Feed never captured (missed baseline) — one-time event seed.
  if (eventSeed && eventSeed.size > 0) {
    const seeded: StickyFeed = {
      date: today,
      deltas: mapToRecord(eventSeed),
    };
    await saveFeed(seeded);
    return new Map(eventSeed);
  }

  return new Map();
}
