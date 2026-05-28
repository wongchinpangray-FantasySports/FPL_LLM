import { getServerSupabase } from "@/lib/supabase";

/** Cloudflare Worker env bindings are limited to ~5 KiB per variable. */
export const CF_ENV_MAX_COOKIE_BYTES = 5_100;

const META_KEY = "fifa_fantasy_auth_cookie";

/** Tracking / consent cookies — not needed for FIFA API fetch. */
const DROP_NAME_PREFIXES = [
  "Optanon",
  "_gcl_",
  "_gads",
  "_gpi",
  "_eoi",
  "_scid",
  "tt_enable",
  "twpid",
  "_ga",
  "_gid",
  "_fbp",
  "eupubconsent",
  "ncmp.",
  "panorama",
  "addtl_consent",
  "usprivacy",
];

function cookieName(pair: string): string {
  return pair.split("=")[0]?.trim() ?? "";
}

/** Strip analytics/consent cookies so the header fits Cloudflare's 5 KiB secret limit. */
export function trimFifaAuthCookie(raw: string): string {
  const parts = raw
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const kept = parts.filter((part) => {
    const name = cookieName(part);
    if (!name) return false;
    return !DROP_NAME_PREFIXES.some(
      (prefix) => name.startsWith(prefix) || name === prefix,
    );
  });
  return kept.join("; ");
}

async function readCookieFromMeta(): Promise<string> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("fpl_meta")
      .select("value")
      .eq("key", META_KEY)
      .maybeSingle();
    if (error) return "";
    return (data?.value as string)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** Env (trimmed) first, then full cookie from Supabase `fpl_meta`. */
export async function getFifaAuthCookie(): Promise<string> {
  const fromEnv = trimFifaAuthCookie(
    process.env.FIFA_FANTASY_AUTH_COOKIE?.trim() ?? "",
  );
  if (fromEnv) return fromEnv;

  const fromMeta = (await readCookieFromMeta()).trim();
  return fromMeta ? trimFifaAuthCookie(fromMeta) : "";
}

export function fifaCookieFitsCloudflareEnv(raw: string): boolean {
  return new TextEncoder().encode(trimFifaAuthCookie(raw)).length <=
    CF_ENV_MAX_COOKIE_BYTES;
}
