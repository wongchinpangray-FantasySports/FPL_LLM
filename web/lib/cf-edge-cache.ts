type DefaultCache = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};

function getDefaultCache(): DefaultCache | null {
  try {
    const caches = (globalThis as { caches?: { default?: DefaultCache } })
      .caches;
    return caches?.default ?? null;
  } catch {
    return null;
  }
}

/**
 * Cache public GET JSON at the Cloudflare colo.
 * Workers do not honor Cache-Control on the Worker response unless we
 * explicitly use the Cache API — every homepage visitor was paying 3–5s
 * for /api/home/hub even after the payload was slimmed.
 */
export async function withCloudflareEdgeCache(
  request: Request,
  generate: () => Promise<Response>,
): Promise<Response> {
  if (request.method !== "GET") return generate();

  const cache = getDefaultCache();
  if (!cache) return generate();

  const cacheKey = new Request(request.url, { method: "GET" });
  try {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("x-faleague-edge-cache", "HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  } catch {
    return generate();
  }

  const generated = await generate();
  const headers = new Headers(generated.headers);
  headers.set("x-faleague-edge-cache", "MISS");
  const out = new Response(generated.body, {
    status: generated.status,
    headers,
  });
  if (generated.status === 200) {
    try {
      await cache.put(cacheKey, out.clone());
    } catch {
      /* quota / uncacheable headers — still return the live response */
    }
  }
  return out;
}
