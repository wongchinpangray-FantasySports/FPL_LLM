import { fplGet, fplGetSession, fplSessionCookie, type FplEntry } from "@/lib/fpl";
import {
  decryptFplCredential,
  encryptFplCredential,
} from "@/lib/auth/fpl-credentials-crypto";
import {
  fplSessionCookieLooksValid,
  trimFplSessionCookie,
} from "@/lib/fpl/session-cookie";
import {
  getAuthUser,
  getUserProfile,
  requireAuthUser,
  type UserProfile,
} from "@/lib/auth/session";
import { getServerSupabase } from "@/lib/supabase";

export class FplAccessError extends Error {
  status: 403 | 404;

  constructor(message: string, status: 403 | 404 = 403) {
    super(message);
    this.name = "FplAccessError";
    this.status = status;
  }
}

export type FplSessionStatus = {
  connected: boolean;
  connected_at: string | null;
};

export async function validateFplEntryExists(entryId: number): Promise<FplEntry> {
  return fplGet<FplEntry>(`/entry/${entryId}/`);
}

/** Signed-in user must own this Entry ID in `profiles.fpl_entry_id`. */
export async function requireFplEntryAccess(entryId: number): Promise<{
  userId: string;
  profile: UserProfile;
}> {
  const user = await requireAuthUser();
  const profile = await getUserProfile(user.id);
  if (!profile?.fpl_entry_id) {
    throw new FplAccessError(
      "Link your FPL Entry ID in Account settings first.",
      403,
    );
  }
  if (profile.fpl_entry_id !== entryId) {
    throw new FplAccessError(
      "This Entry ID is not linked to your account.",
      403,
    );
  }
  return { userId: user.id, profile };
}

/** Redirect target when URL entry id does not match profile. */
export async function resolveLinkedFplEntryId(): Promise<number | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const profile = await getUserProfile(user.id);
  return profile?.fpl_entry_id ?? null;
}

export async function getUserFplSessionCookie(
  userId: string,
): Promise<string | null> {
  const admin = getServerSupabase();
  const { data, error } = await admin
    .from("user_fpl_credentials")
    .select("session_cookie")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.session_cookie) return null;

  try {
    const decrypted = decryptFplCredential(String(data.session_cookie));
    const trimmed = trimFplSessionCookie(decrypted);
    return trimmed || null;
  } catch {
    return null;
  }
}

export async function getFplSessionStatus(
  userId: string,
): Promise<FplSessionStatus> {
  const admin = getServerSupabase();
  const { data } = await admin
    .from("user_fpl_credentials")
    .select("connected_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.connected_at) {
    return { connected: false, connected_at: null };
  }
  return {
    connected: true,
    connected_at: String(data.connected_at),
  };
}

export async function saveUserFplSessionCookie(
  userId: string,
  rawCookie: string,
): Promise<void> {
  const trimmed = trimFplSessionCookie(rawCookie);
  if (!fplSessionCookieLooksValid(trimmed)) {
    throw new Error(
      "Cookie looks invalid — copy the full Cookie header while logged in at fantasy.premierleague.com (needs pl_profile).",
    );
  }

  const admin = getServerSupabase();
  const now = new Date().toISOString();
  const stored = encryptFplCredential(trimmed);

  const { error } = await admin.from("user_fpl_credentials").upsert(
    {
      user_id: userId,
      session_cookie: stored,
      connected_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function clearUserFplSessionCookie(userId: string): Promise<void> {
  const admin = getServerSupabase();
  await admin.from("user_fpl_credentials").delete().eq("user_id", userId);
}

/** Session cookie for `/my-team/`: per-user connect, then optional deploy env fallback. */
export async function resolveFplSessionCookieForUser(
  userId: string,
): Promise<string | undefined> {
  const userCookie = await getUserFplSessionCookie(userId);
  if (userCookie) return userCookie;
  return fplSessionCookie();
}

/** Verify stored cookie can read this entry's Pick Team page. */
export async function verifyFplSessionForEntry(
  entryId: number,
  cookie: string,
): Promise<boolean> {
  const trimmed = trimFplSessionCookie(cookie);
  if (!trimmed) return false;
  const resp = await fplGetSession<{ picks?: unknown[] }>(
    `/my-team/${entryId}/`,
    { cookie: trimmed },
  );
  return Boolean(resp?.picks?.length);
}

export function isFplEntryUniqueViolation(message: string): boolean {
  return /duplicate key|unique constraint|fpl_entry_id/i.test(message);
}
