import { Redis } from "@upstash/redis";
import { shanghaiDateIso } from "@/lib/fpl/wechat-daily-card";
import {
  fetchLatestLiveFplPriceMoves,
  matchMovesToFplIds,
} from "@/lib/fpl/livefpl-price-changes";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id string. */
export type PriceSnapshot = Record<string, number>;

type StickyFeed = {
  /** Date the moves happened (LiveFPL / Shanghai), YYYY-MM-DD */
  date: string;
  deltas: Record<string, number>;
};

const TTL_SEC = 14 * 24 * 60 * 60;
const FEED_KEY = "fpl:px-latest-feed-v6";
const OPEN_PREFIX = "fpl:px-open-v6:";

const memoryFeed: { value: StickyFeed | null } = { value: null };
const memoryOpen = new Map<string, PriceSnapshot>();

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

function asFeed(raw: unknown): StickyFeed | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as StickyFeed;
  if (!row.date || typeof row.deltas !== "object" || !row.deltas) return null;
  return row;
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

function toCompact(snapshot: PriceSnapshot): [number, number][] {
  const out: [number, number][] = [];
  for (const [id, cost] of Object.entries(snapshot)) {
    const n = Number(id);
    if (Number.isFinite(n) && Number.isFinite(cost)) out.push([n, cost]);
  }
  return out;
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

async function loadStickyFeed(): Promise<StickyFeed | null> {
  if (memoryFeed.value) return memoryFeed.value;
  const r = redis();
  if (!r) return null;
  try {
    const raw = asFeed(await r.get(FEED_KEY));
    if (raw) memoryFeed.value = raw;
    return raw;
  } catch {
    return null;
  }
}

async function saveStickyFeed(feed: StickyFeed): Promise<void> {
  memoryFeed.value = feed;
  const r = redis();
  if (!r) return;
  try {
    await r.set(FEED_KEY, feed, { ex: TTL_SEC });
  } catch {
    /* ignore */
  }
}

async function ensureDayOpen(date: string, current: PriceSnapshot): Promise<PriceSnapshot> {
  const key = `${OPEN_PREFIX}${date}`;
  const mem = memoryOpen.get(key);
  if (mem) return mem;

  const r = redis();
  if (r) {
    try {
      const existing = fromCompact(await r.get(key));
      if (existing) {
        memoryOpen.set(key, existing);
        return existing;
      }
      await r.set(key, toCompact(current), { nx: true, ex: TTL_SEC });
      const after = fromCompact(await r.get(key));
      if (after) {
        memoryOpen.set(key, after);
        return after;
      }
    } catch {
      /* fall through */
    }
  }

  memoryOpen.set(key, current);
  return current;
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

export type DailyPriceResult = {
  /** Date label for the movers batch (may be yesterday until next window). */
  changeDate: string;
  deltas: Map<number, number>;
};

/**
 * Latest completed daily price movers — sticky until the next real price window.
 *
 * Sources (in order):
 * 1. LiveFPL price_changes (authoritative completed batches)
 * 2. Diff vs today's open snapshot (if we captured pre-window prices)
 * 3. Existing sticky Redis feed
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
  bootstrap?: {
    elements: {
      id: number;
      web_name?: string;
      team: number;
      now_cost?: number;
    }[];
    teams: { id: number; name?: string; short_name?: string }[];
  },
): Promise<DailyPriceResult> {
  const today = shanghaiDateIso();
  try {
    const sticky = await loadStickyFeed();
    let feed = sticky;
    let deltas = feedToMap(sticky);

    // Prefer LiveFPL's latest completed batch — survives midnight and missed baselines.
    if (bootstrap?.elements?.length) {
      const live = await fetchLatestLiveFplPriceMoves();
      if (live.latestDate && live.moves.length) {
        const matched = matchMovesToFplIds(
          live.moves,
          bootstrap.elements,
          bootstrap.teams ?? [],
        );
        if (matched.size > 0) {
          const shouldReplace =
            !feed ||
            feed.date < live.latestDate ||
            Object.keys(feed.deltas).length === 0;
          if (shouldReplace) {
            feed = {
              date: live.latestDate,
              deltas: mapToRecord(matched),
            };
            await saveStickyFeed(feed);
            deltas = matched;
          } else if (
            feed &&
            feed.date === live.latestDate &&
            deltas.size === 0
          ) {
            feed = {
              date: live.latestDate,
              deltas: mapToRecord(matched),
            };
            await saveStickyFeed(feed);
            deltas = matched;
          }
        }
      }
    }

    // Also merge any same-day open-diff movers (covers LiveFPL lag).
    const open = await ensureDayOpen(today, current);
    const fresh = computeDeltas(current, open);
    if (fresh.size > 0) {
      const next = new Map(deltas);
      for (const [id, d] of fresh) next.set(id, d);
      feed = {
        date: today,
        deltas: mapToRecord(next),
      };
      await saveStickyFeed(feed);
      deltas = next;
    }

    return {
      changeDate: feed?.date ?? today,
      deltas,
    };
  } catch {
    return { changeDate: today, deltas: new Map() };
  }
}
