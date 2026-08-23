import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { mergeBadges, type MiniBadgeId } from "@/lib/mini/badges";
import { getProfileBadgeEvents } from "@/lib/mini/badge-events";
import {
  guestEntryIdFromProfileId,
  isValidNickname,
  sanitizeNickname,
} from "@/lib/mini/profile";

export const dynamic = "force-dynamic";

interface ProfileBody {
  profile_id?: string;
  nickname?: string;
  fpl_entry_id?: number | null;
  unlock_badges?: MiniBadgeId[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profile_id")?.trim();
  const fplEntryIdRaw = searchParams.get("fpl_entry_id")?.trim();
  const seasonParam = searchParams.get("season")?.trim();

  if (!profileId && !fplEntryIdRaw) {
    return NextResponse.json(
      { error: "profile_id or fpl_entry_id required" },
      { status: 400 },
    );
  }

  const supa = getServerSupabase();
  let q = supa
    .from("mini_profiles")
    .select("id,nickname,fpl_entry_id,badges,updated_at");

  if (profileId) {
    q = q.eq("id", profileId);
  } else {
    const fplEntryId = Number(fplEntryIdRaw);
    if (!Number.isInteger(fplEntryId) || fplEntryId <= 0) {
      return NextResponse.json({ error: "Invalid fpl_entry_id" }, { status: 400 });
    }
    q = q.eq("fpl_entry_id", fplEntryId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) {
    if (/schema cache|does not exist|Could not find/i.test(error.message)) {
      return NextResponse.json({ profile: null, needs_migration: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ profile: null });
  }

  const season = seasonParam || (await getCurrentFplSeason());
  let badgeEvents: Awaited<ReturnType<typeof getProfileBadgeEvents>> = [];
  try {
    badgeEvents = await getProfileBadgeEvents(supa, data.id as string, season);
  } catch {
    badgeEvents = [];
  }

  const badgeCount = badgeEvents.length;
  const badgesEarned = mergeBadges(
    (data.badges as string[] | null) ?? [],
    badgeEvents.map((e) => e.badge_id),
  );

  return NextResponse.json({
    profile: {
      ...data,
      badges: badgesEarned,
      guest_entry_id: guestEntryIdFromProfileId(data.id as string),
      badge_count: badgeCount,
      badge_events: badgeEvents,
      season,
    },
  });
}

export async function POST(req: Request) {
  let body: ProfileBody;
  try {
    body = (await req.json()) as ProfileBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  if (!profileId || profileId.length < 8 || profileId.length > 64) {
    return NextResponse.json({ error: "Valid profile_id is required" }, { status: 400 });
  }
  if (!isValidNickname(body.nickname ?? "")) {
    return NextResponse.json(
      { error: "Nickname must be 2–24 characters" },
      { status: 400 },
    );
  }
  const nickname = sanitizeNickname(body.nickname!);
  const fplEntryId =
    body.fpl_entry_id == null || body.fpl_entry_id === 0
      ? null
      : Number(body.fpl_entry_id);
  if (fplEntryId != null && (!Number.isInteger(fplEntryId) || fplEntryId <= 0)) {
    return NextResponse.json({ error: "Invalid fpl_entry_id" }, { status: 400 });
  }

  const unlock = Array.isArray(body.unlock_badges)
    ? body.unlock_badges.filter((b): b is MiniBadgeId => typeof b === "string")
    : [];

  const supa = getServerSupabase();
  const { data: existing } = await supa
    .from("mini_profiles")
    .select("badges")
    .eq("id", profileId)
    .maybeSingle();

  const badges = mergeBadges(
    (existing?.badges as string[] | null) ?? [],
    unlock,
  );

  const { data, error } = await supa
    .from("mini_profiles")
    .upsert(
      {
        id: profileId,
        nickname,
        fpl_entry_id: fplEntryId,
        badges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id,nickname,fpl_entry_id,badges,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: {
      ...data,
      guest_entry_id: guestEntryIdFromProfileId(data.id as string),
      newly_unlocked: unlock.filter(
        (id) => !(existing?.badges as string[] | null)?.includes(id),
      ),
    },
  });
}
