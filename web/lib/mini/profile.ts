/** Client-side Mini 5 profile identity (localStorage). */

export const MINI_PROFILE_ID_KEY = "miniProfileId";
export const MINI_NICKNAME_KEY = "miniNickname";
export const MINI_USED_TEMPLATE_KEY = "miniUsedTemplate";

/** Stable negative entry_id for guests (avoids colliding with FPL entry IDs). */
export function guestEntryIdFromProfileId(profileId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < profileId.length; i++) {
    hash ^= profileId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = (hash >>> 0) % 900_000_000;
  return -(100_000_000 + positive);
}

export function newMiniProfileId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mini_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function isValidNickname(raw: string): boolean {
  const n = sanitizeNickname(raw);
  return n.length >= 2 && n.length <= 24;
}
