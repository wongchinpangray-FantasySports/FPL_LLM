import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { getCurrentFplSeason } from "@/lib/fpl-season";
import { buildSeasonLadder } from "@/lib/mini/season-ladder";
import { mergeBadges } from "@/lib/mini/badges";

export const dynamic = "force-dynamic";

function randomCode(len = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profile_id")?.trim();
  const code = searchParams.get("code")?.trim().toUpperCase();
  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();

  if (code) {
    const { data: league, error } = await supa
      .from("mini_leagues")
      .select("id,code,name,season,created_at")
      .eq("season", season)
      .ilike("code", code)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    const { data: members } = await supa
      .from("mini_league_members")
      .select("profile_id")
      .eq("league_id", league.id);
    const profileIds = (members ?? []).map((m) => m.profile_id as string);
    const ladder = await buildSeasonLadder({ profileIds, limit: 100 });
    return NextResponse.json({ league, standings: ladder.rows });
  }

  if (!profileId) {
    return NextResponse.json(
      { error: "profile_id or code required" },
      { status: 400 },
    );
  }

  const { data: memberships, error } = await supa
    .from("mini_league_members")
    .select("league_id, league:mini_leagues(id,code,name,season,created_at)")
    .eq("profile_id", profileId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leagues = (memberships ?? [])
    .map((m) => {
      const raw = m.league as
        | { id: string; code: string; name: string; season: string; created_at: string }
        | { id: string; code: string; name: string; season: string; created_at: string }[]
        | null;
      if (!raw) return null;
      return Array.isArray(raw) ? raw[0] : raw;
    })
    .filter((l): l is NonNullable<typeof l> => Boolean(l && l.season === season));

  return NextResponse.json({ leagues });
}

export async function POST(req: Request) {
  let body: {
    action?: string;
    profile_id?: string;
    nickname?: string;
    name?: string;
    code?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = body.profile_id?.trim();
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }

  const season = await getCurrentFplSeason();
  const supa = getServerSupabase();

  // Ensure profile exists (nickname optional update)
  const { data: profile } = await supa
    .from("mini_profiles")
    .select("id,badges,nickname")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Create a nickname profile first" },
      { status: 400 },
    );
  }

  const action = body.action ?? "create";

  if (action === "create") {
    const name = (body.name ?? "").trim().slice(0, 40);
    if (name.length < 2) {
      return NextResponse.json({ error: "League name too short" }, { status: 400 });
    }
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const { data: league, error } = await supa
        .from("mini_leagues")
        .insert({
          code,
          name,
          season,
          created_by: profileId,
        })
        .select("id,code,name,season,created_at")
        .single();
      if (!error && league) {
        await supa.from("mini_league_members").upsert({
          league_id: league.id,
          profile_id: profileId,
        });
        const badges = mergeBadges((profile.badges as string[]) ?? [], [
          "league_joiner",
        ]);
        await supa
          .from("mini_profiles")
          .update({ badges, updated_at: new Date().toISOString() })
          .eq("id", profileId);
        return NextResponse.json({
          league,
          newly_unlocked: ["league_joiner"],
        });
      }
      code = randomCode();
    }
    return NextResponse.json({ error: "Could not create league" }, { status: 500 });
  }

  if (action === "join") {
    const code = (body.code ?? "").trim().toUpperCase();
    if (code.length < 4) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }
    const { data: league, error } = await supa
      .from("mini_leagues")
      .select("id,code,name,season,created_at")
      .eq("season", season)
      .ilike("code", code)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }
    const { error: joinErr } = await supa.from("mini_league_members").upsert({
      league_id: league.id,
      profile_id: profileId,
    });
    if (joinErr) {
      return NextResponse.json({ error: joinErr.message }, { status: 500 });
    }
    const badges = mergeBadges((profile.badges as string[]) ?? [], [
      "league_joiner",
    ]);
    await supa
      .from("mini_profiles")
      .update({ badges, updated_at: new Date().toISOString() })
      .eq("id", profileId);
    return NextResponse.json({
      league,
      newly_unlocked: ["league_joiner"],
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
