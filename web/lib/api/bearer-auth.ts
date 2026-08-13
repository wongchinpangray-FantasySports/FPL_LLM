import { timingSafeEqual } from "node:crypto";

export type BearerAuthResult = {
  ok: boolean;
  status: number;
  error?: string;
};

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Timing-safe Bearer auth against one primary env key + optional comma-separated extras.
 */
export function authorizeBearerRequest(
  req: Request,
  opts: {
    singleEnv: string;
    multiEnv?: string;
    notConfiguredMessage: string;
  },
): BearerAuthResult {
  const keys = collectEnvApiKeys(opts.singleEnv, opts.multiEnv);
  if (keys.length === 0) {
    return {
      ok: false,
      status: 503,
      error: opts.notConfiguredMessage,
    };
  }

  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!m) {
    return { ok: false, status: 401, error: "Missing Bearer token." };
  }
  const presented = m[1].trim();
  for (const key of keys) {
    if (timingSafeStringEqual(presented, key)) {
      return { ok: true, status: 200 };
    }
  }
  return { ok: false, status: 401, error: "Unauthorized." };
}

export function collectEnvApiKeys(
  singleEnv: string,
  multiEnv?: string,
): string[] {
  const single = process.env[singleEnv]?.trim();
  const multi = (multiEnv ? (process.env[multiEnv] ?? "") : "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const out = new Set<string>();
  if (single) out.add(single);
  for (const k of multi) out.add(k);
  return [...out];
}
