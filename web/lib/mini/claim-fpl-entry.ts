/** Free an FPL Entry ID so it can be linked to a Mini 5 profile. */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Clears `fpl_entry_id` from any other mini_profiles row so the current
 * profile can claim it. Same Entry ID often collides when a user switches
 * devices (new local profile_id) but reuses their FPL ID.
 */
export async function claimMiniProfileFplEntryId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supa: SupabaseClient<any, any, any>,
  profileId: string,
  fplEntryId: number | null,
): Promise<{ error: string | null }> {
  if (fplEntryId == null || fplEntryId <= 0) return { error: null };

  const now = new Date().toISOString();
  const { error } = await supa
    .from("mini_profiles")
    .update({ fpl_entry_id: null, updated_at: now })
    .eq("fpl_entry_id", fplEntryId)
    .neq("id", profileId);

  if (error && !/schema cache|does not exist|Could not find/i.test(error.message)) {
    return { error: error.message };
  }
  return { error: null };
}

export function isMiniFplEntryUniqueViolation(message: string): boolean {
  return /duplicate key|unique constraint|mini_profiles_fpl_entry_id/i.test(
    message,
  );
}
