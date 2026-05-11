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
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    const ai = (env as unknown as { AI?: AiBinding }).AI;
    if (!ai?.gateway) return undefined;
    const url = await ai.gateway(gatewayName).getUrl("google-ai-studio");
    return url.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export async function resolveGeminiGatewayBaseUrlAsync(): Promise<string | undefined> {
  const sync = resolveGeminiGatewayBaseUrlSync();
  if (sync) return sync;
  return resolveGeminiGatewayBaseUrlFromBinding();
}

export function buildGeminiHttpOptions(baseUrl: string): {
  baseUrl: string;
  headers?: Record<string, string>;
} {
  const raw =
    process.env.GEMINI_AI_GATEWAY_TOKEN?.trim() ??
    process.env.CF_AIG_AUTHORIZATION?.trim() ??
    "";
  const headers: Record<string, string> = {};
  if (raw) {
    headers["cf-aig-authorization"] = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
  }
  return Object.keys(headers).length ? { baseUrl, headers } : { baseUrl };
}
