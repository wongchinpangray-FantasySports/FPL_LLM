/**
 * Resolve Cloudflare AI Gateway base URL for Google AI Studio (Gemini).
 *
 * 1) Explicit: `GEMINI_AI_GATEWAY_BASE_URL` or `CF_AI_GATEWAY_GEMINI_BASE_URL`
 * 2) Composed: `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_GATEWAY_NAME` (or `CF_*` aliases)
 * 3) Workers **AI binding**: `wrangler.jsonc` → `"ai": { "binding": "AI" }` and only
 *    `CLOUDFLARE_AI_GATEWAY_NAME` — uses `env.AI.gateway(name).getUrl("google-ai-studio")`
 *    (no account id in env).
 *
 * @see https://developers.cloudflare.com/ai-gateway/providers/google-ai-studio/
 * @see https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/
 */

type AiBinding = {
  gateway: (id: string) => { getUrl: (provider?: string) => Promise<string> };
};

/** OpenNext stores request Worker context here (must match `@opennextjs/cloudflare`). */
const OPENNEXT_CF_CONTEXT = Symbol.for("__cloudflare-context__");

function tryReadEnvFromOpenNextGlobal(): Record<string, unknown> | undefined {
  try {
    const box = (globalThis as unknown as Record<symbol, { env?: unknown } | undefined>)[
      OPENNEXT_CF_CONTEXT
    ];
    const env = box?.env;
    if (env && typeof env === "object") return env as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return undefined;
}

async function getCloudflareWorkerEnv(): Promise<Record<string, unknown> | null> {
  const fromGlobal = tryReadEnvFromOpenNextGlobal();
  if (fromGlobal) return fromGlobal;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function resolveGeminiGatewayBaseUrlSync(): string | undefined {
  const explicit = (
    process.env.GEMINI_AI_GATEWAY_BASE_URL ??
    process.env.CF_AI_GATEWAY_GEMINI_BASE_URL ??
    ""
  )
    .trim()
    .replace(/\/$/, "");
  if (explicit) return explicit;

  const account =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ??
    process.env.CF_ACCOUNT_ID?.trim();
  const gatewayName =
    process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim() ??
    process.env.CF_AI_GATEWAY_NAME?.trim();
  if (account && gatewayName) {
    return `https://gateway.ai.cloudflare.com/v1/${account}/${gatewayName}/google-ai-studio`;
  }
  return undefined;
}

async function resolveGeminiGatewayBaseUrlFromBinding(): Promise<string | undefined> {
  const gatewayName =
    process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim() ??
    process.env.CF_AI_GATEWAY_NAME?.trim() ??
    "";
  if (!gatewayName) return undefined;

  try {
    const env = await getCloudflareWorkerEnv();
    if (!env) {
      console.warn(
        "[gemini-gateway] No Cloudflare env (OpenNext context missing). Is this route running on a Cloudflare Worker?",
      );
      return undefined;
    }
    const ai = env.AI as AiBinding | undefined;
    if (!ai?.gateway) {
      console.warn(
        "[gemini-gateway] CLOUDFLARE_AI_GATEWAY_NAME is set but env.AI binding is missing. Redeploy with wrangler.jsonc `ai` binding.",
      );
      return undefined;
    }
    let url: string;
    try {
      url = await ai.gateway(gatewayName).getUrl("google-ai-studio");
    } catch (e1) {
      try {
        const root = await ai.gateway(gatewayName).getUrl();
        url = `${root.replace(/\/$/, "")}/google-ai-studio`;
      } catch (e2) {
        console.warn(
          "[gemini-gateway] gateway.getUrl failed:",
          e1 instanceof Error ? e1.message : e1,
          e2 instanceof Error ? e2.message : e2,
        );
        return undefined;
      }
    }
    return url.replace(/\/$/, "");
  } catch (e) {
    console.warn(
      "[gemini-gateway] getCloudflareContext / AI gateway URL failed:",
      e instanceof Error ? e.message : e,
    );
    return undefined;
  }
}

export async function resolveGeminiGatewayBaseUrlAsync(): Promise<string | undefined> {
  const sync = resolveGeminiGatewayBaseUrlSync();
  if (sync) return sync;
  return resolveGeminiGatewayBaseUrlFromBinding();
}

/** True when user relies on env.AI + gateway name only (no full URL, no account id). */
export function expectsAiBindingGatewayOnly(): boolean {
  const name =
    process.env.CLOUDFLARE_AI_GATEWAY_NAME?.trim() ??
    process.env.CF_AI_GATEWAY_NAME?.trim() ??
    "";
  if (!name) return false;
  if (
    process.env.GEMINI_AI_GATEWAY_BASE_URL?.trim() ||
    process.env.CF_AI_GATEWAY_GEMINI_BASE_URL?.trim()
  ) {
    return false;
  }
  const account =
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ??
    process.env.CF_ACCOUNT_ID?.trim() ??
    "";
  return !account;
}

export function buildGeminiHttpOptions(baseUrl: string): {
  baseUrl: string;
  /** Cloudflare AI Gateway expects Gemini REST under `.../google-ai-studio/v1/...`; the SDK defaults to `v1beta`, which breaks routing. */
  apiVersion?: string;
  headers?: Record<string, string>;
} {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  const isCloudflareAiGateway = trimmed.includes("gateway.ai.cloudflare.com");
  const raw =
    process.env.GEMINI_AI_GATEWAY_TOKEN?.trim() ??
    process.env.CF_AIG_AUTHORIZATION?.trim() ??
    "";
  const headers: Record<string, string> = {};
  if (raw) {
    headers["cf-aig-authorization"] = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
  }
  const out: {
    baseUrl: string;
    apiVersion?: string;
    headers?: Record<string, string>;
  } = {
    baseUrl: trimmed,
    ...(isCloudflareAiGateway ? { apiVersion: "v1" } : {}),
  };
  if (Object.keys(headers).length) out.headers = headers;
  return out;
}
