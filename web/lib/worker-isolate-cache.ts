type CacheEntry = {
  at: number;
  value?: unknown;
  promise?: Promise<unknown>;
};

const store = new Map<string, CacheEntry>();

/** Short-lived cache for Cloudflare Worker isolates (`unstable_cache` is a no-op without R2). */
export async function withIsolateCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry?.value !== undefined && now - entry.at < ttlMs) {
    return entry.value as T;
  }
  if (entry?.promise) {
    return entry.promise as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .catch((err) => {
      const cur = store.get(key);
      if (cur?.promise === promise) store.delete(key);
      throw err;
    });

  store.set(key, { at: now, promise });
  return promise as Promise<T>;
}
