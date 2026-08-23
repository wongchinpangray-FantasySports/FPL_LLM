import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { getServerSupabase } from "@/lib/supabase";
import { guestEntryIdFromProfileId } from "@/lib/mini/profile";
import {
  MINI_BADGES,
  type MiniBadgeId,
} from "@/lib/mini/badges";

/** Earned at most once per season (GW column null). */
export const MINI_BADGE_ONCE: MiniBadgeId[] = [
  "first_squad",
  "template_starter",
  "league_joiner",
];

/** Can be earned again each gameweek. */
export const MINI_BADGE_PER_GW: MiniBadgeId[] = [
  "gw_ready",
  "hot_captain",
  "diff_captain",
  "mission_complete",
];

export interface MiniBadgeEventRow {
  id: string;
  profile_id: string;
  badge_id: MiniBadgeId;
  gw: number | null;
  season: string;
  unlocked_at: string;
}

export interface BadgesLadderRow {
  rank: number;
  profile_id: string;
  entry_id: number | null;
  entry_name: string | null;
  badge_count: number;
  unique_badges: number;
  badges: MiniBadgeId[];
}

function isOnceBadge(id: MiniBadgeId): boolean {
  return MINI_BADGE_ONCE.includes(id);
}

function validBadgeId(id: string): id is MiniBadgeId {
  return MINI_BADGES.some((b) => b.id === id);
}

/** Insert badge events; skips duplicates per unique indexes. Returns newly stored ids. */
export async function recordMiniBadgeEvents(
  supa: SupabaseClient,
  opts: {
    profileId: string;
    season: string;
    gw: number | null;
    badgeIds: MiniBadgeId[];
  },
): Promise<MiniBadgeId[]> {
  const { profileId, season, gw, badgeIds } = opts;
  const uniq = [...new Set(badgeIds)];
  const recorded: MiniBadgeId[] = [];

  for (const badgeId of uniq) {
    const row = {
      profile_id: profileId,
      badge_id: badgeId,
      gw: isOnceBadge(badgeId) ? null : gw,
      season,
      unlocked_at: new Date().toISOString(),
    };

    const { error } = await supa.from("mini_badge_events").insert(row);
    if (!error) {
      recorded.push(badgeId);
      continue;
    }
    if (/duplicate key|unique constraint|23505/i.test(error.message)) {
      continue;
    }
    if (/schema cache|does not exist|Could not find/i.test(error.message)) {
      return recorded;
    }
    throw new Error(error.message);
  }

  return recorded;
}

export async function getProfileBadgeEvents(
  supa: SupabaseClient,
  profileId: string,
  season?: string,
): Promise<MiniBadgeEventRow[]> {
  const s = season ?? (await getCurrentFplSeason());
  const { data, error } = await supa
    .from("mini_badge_events")
    .select("id,profile_id,badge_id,gw,season,unlocked_at")
    .eq("profile_id", profileId)
    .eq("season", s)
    .order("unlocked_at", { ascending: false });

  if (error) {
    if (/schema cache|does not exist|Could not find/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((r) => validBadgeId(String(r.badge_id)))
    .map((r) => ({
      id: r.id as string,
      profile_id: r.profile_id as string,
      badge_id: r.badge_id as MiniBadgeId,
      gw: r.gw as number | null,
      season: r.season as string,
      unlocked_at: r.unlocked_at as string,
    }));
}

export async function buildBadgesLadder(opts?: {
  limit?: number;
  season?: string;
}): Promise<{ season: string; rows: BadgesLadderRow[] }> {
  const supa = getServerSupabase();
  const season = opts?.season ?? (await getCurrentFplSeason());
  const limit = opts?.limit ?? 50;

  const { data: events, error: evErr } = await supa
    .from("mini_badge_events")
    .select("profile_id,badge_id")
    .eq("season", season);

  if (evErr) {
    if (/schema cache|does not exist|Could not find/i.test(evErr.message)) {
      return { season, rows: [] };
    }
    throw new Error(evErr.message);
  }

  if (!events?.length) {
    return { season, rows: [] };
  }

  const byProfile = new Map<
    string,
    { badge_count: number; badges: Set<MiniBadgeId> }
  >();
  for (const ev of events) {
    const pid = ev.profile_id as string;
    const bid = String(ev.badge_id);
    if (!validBadgeId(bid)) continue;
    const cur = byProfile.get(pid) ?? {
      badge_count: 0,
      badges: new Set<MiniBadgeId>(),
    };
    cur.badge_count += 1;
    cur.badges.add(bid);
    byProfile.set(pid, cur);
  }

  const profileIds = [...byProfile.keys()];
  const { data: profiles } = await supa
    .from("mini_profiles")
    .select("id,nickname,fpl_entry_id")
    .in("id", profileIds);

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p]),
  );

  const rows = profileIds
    .map((profileId) => {
      const agg = byProfile.get(profileId)!;
      const prof = profileById.get(profileId);
      const fplEntryId = prof?.fpl_entry_id as number | null | undefined;
      return {
        profile_id: profileId,
        entry_id:
          fplEntryId != null && fplEntryId > 0
            ? fplEntryId
            : guestEntryIdFromProfileId(profileId),
        entry_name: (prof?.nickname as string | null) ?? null,
        badge_count: agg.badge_count,
        unique_badges: agg.badges.size,
        badges: MINI_BADGES.map((b) => b.id).filter((id) => agg.badges.has(id)),
      };
    })
    .sort(
      (a, b) =>
        b.badge_count - a.badge_count ||
        b.unique_badges - a.unique_badges ||
        (a.entry_name ?? "").localeCompare(b.entry_name ?? ""),
    )
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, ...row }));

  return { season, rows };
}
