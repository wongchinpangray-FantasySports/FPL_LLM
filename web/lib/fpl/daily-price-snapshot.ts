import { Redis } from "@upstash/redis";
import {
  shanghaiDateIso,
  shanghaiYesterdayIso,
} from "@/lib/fpl/wechat-daily-card";

/** FPL bootstrap `now_cost` (tenths of £m) keyed by player id. */
export type PriceSnapshot = Record<number, number>;

const SNAPSHOT_TTL_SEC = 8 * 24 * 60 * 60;
const memorySnapshots = new Map<string, PriceSnapshot>();

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function snapshotKey(date: string, variant: "close" | "open" = "close"): string {
  return variant === "open"
    ? `fpl:price-open:${date}`
    : `fpl:price-close:${date}`;
}

async function loadSnapshot(
  date: string,
  variant: "close" | "open" = "close",
): Promise<PriceSnapshot | null> {
  const key = snapshotKey(date, variant);
  const fromMemory = memorySnapshots.get(key);
  if (fromMemory) return fromMemory;

  const r = redis();
  if (!r) return null;
  const raw = await r.get<PriceSnapshot>(key);
  if (!raw || typeof raw !== "object") return null;
  memorySnapshots.set(key, raw);
  return raw;
}

async function saveSnapshot(
  date: string,
  prices: PriceSnapshot,
  variant: "close" | "open" = "close",
): Promise<void> {
  const key = snapshotKey(date, variant);
  memorySnapshots.set(key, prices);
  if (memorySnapshots.size > 16) {
    const oldest = memorySnapshots.keys().next().value;
    if (oldest) memorySnapshots.delete(oldest);
  }

  const r = redis();
  if (!r) return;
  await r.set(key, prices, { ex: SNAPSHOT_TTL_SEC });
}

/** Capture today's opening prices once (first request of the Shanghai day). */
async function ensureOpenSnapshot(
  today: string,
  prices: PriceSnapshot,
): Promise<void> {
  const key = snapshotKey(today, "open");
  if (memorySnapshots.has(key)) return;

  const r = redis();
  if (r) {
    const created = await r.setnx(key, prices);
    if (created) await r.expire(key, SNAPSHOT_TTL_SEC);
    if (created) memorySnapshots.set(key, prices);
    return;
  }

  if (!memorySnapshots.has(key)) {
    memorySnapshots.set(key, prices);
  }
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
 * Daily £0.1 deltas vs yesterday's closing snapshot (fallback: today's open).
 * Returns tenths → pounds in caller.
 */
export async function dailyPriceDeltaTenths(
  current: PriceSnapshot,
): Promise<Map<number, number>> {
  const today = shanghaiDateIso();
  const yesterday = shanghaiYesterdayIso();

  await Promise.all([
    saveSnapshot(today, current, "close"),
    ensureOpenSnapshot(today, current),
  ]);

  const baseline =
    (await loadSnapshot(yesterday, "close")) ??
    (await loadSnapshot(today, "open"));

  const deltas = new Map<number, number>();
  if (!baseline) return deltas;

  for (const [idStr, nowTenths] of Object.entries(current)) {
    const id = Number(idStr);
    const prev = baseline[id];
    if (prev == null || !Number.isFinite(prev)) continue;
    const deltaTenths = nowTenths - prev;
    if (deltaTenths !== 0) deltas.set(id, deltaTenths);
  }

  return deltas;
}
