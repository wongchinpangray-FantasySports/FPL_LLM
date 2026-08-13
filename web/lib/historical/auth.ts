import { authorizeBearerRequest } from "@/lib/api/bearer-auth";

/**
 * Bearer auth for historical partner API (stats / player detail).
 * Env: `HISTORICAL_API_KEY`
 * Optional extras: `HISTORICAL_API_KEYS=key1,key2`
 */
export function authorizeHistoricalRequest(req: Request): {
  ok: boolean;
  status: number;
  error?: string;
} {
  return authorizeBearerRequest(req, {
    singleEnv: "HISTORICAL_API_KEY",
    multiEnv: "HISTORICAL_API_KEYS",
    notConfiguredMessage:
      "Historical API not configured (set HISTORICAL_API_KEY).",
  });
}
