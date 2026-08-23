import { authorizeBearerRequest } from "@/lib/api/bearer-auth";

/**
 * Bearer auth for contest organizer API.
 * Env: `CONTEST_API_KEY` (required in production).
 * Optional comma-separated keys: `CONTEST_API_KEYS=key1,key2`.
 */
export function authorizeContestRequest(req: Request): {
  ok: boolean;
  status: number;
  error?: string;
} {
  return authorizeBearerRequest(req, {
    singleEnv: "CONTEST_API_KEY",
    multiEnv: "CONTEST_API_KEYS",
    notConfiguredMessage:
      "Contest API not configured (set CONTEST_API_KEY).",
  });
}
