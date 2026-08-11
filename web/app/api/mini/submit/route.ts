import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { resolveSubmissionGw } from "@/lib/mini/gameweek";
import {
  validateCaptaincy,
  validateMiniSquad,
  type MiniPickInput,
} from "@/lib/mini/validate";
import {
  MINI_PLAYER_DISPLAY_COLS,
  rowToMiniPlayerDisplay,
} from "@/lib/mini/player-stats";
import type { MiniPickStored } from "@/lib/mini/types";
import { mergeBadges, type MiniBadgeId } from "@/lib/mini/badges";
import { getMiniHotPicks } from "@/lib/mini/hot-picks";
import {
  guestEntryIdFromProfileId,
  isValidNickname,
  sanitizeNickname,
} from "@/lib/mini/profile";

export const dynamic = "force-dynamic";

interface SubmitBody {
  entry_id?: number;
  entry_name?: string;
  nickname?: string;
  profile_id?: string;
  gw?: number;
  picks?: number[];
  captain_fpl_id?: number;
  vice_fpl_id?: number;
  used_template?: boolean;
}

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId =
    typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  const nicknameRaw = body.nickname ?? body.entry_name ?? "";
  const hasNickname = isValidNickname(nicknameRaw);
  const nickname = hasNickname ? sanitizeNickname(nicknameRaw) : null;

  let entryId = Number(body.entry_id);
  if (profileId && (!Number.isInteger(entryId) || entryId <= 0)) {
    entryId = guestEntryIdFromProfileId(profileId);
  }
  if (!Number.isInteger(entryId) || entryId === 0) {
    return NextResponse.json(
      { error: "Valid entry_id or profile_id is required" },
      { status: 400 },
    );
  }
  if (!profileId && entryId < 0) {
    return NextResponse.json(
      { error: "profile_id is required for guest entries" },
      { status: 400 },
    );
  }
  if (!hasNickname && entryId < 0) {
    return NextResponse.json(
      { error: "Nickname must be 2–24 characters" },
      { status: 400 },
    );
  }

  const pickIds = body.picks;
  if (!Array.isArray(pickIds) || pickIds.length !== 5) {
    return NextResponse.json(
      { error: "picks must be an array of exactly 5 FPL player IDs" },
      { status: 400 },
    );
  }

  const captainFplId = Number(body.captain_fpl_id);
  const viceFplId = Number(body.vice_fpl_id);
  if (!pickIds.every((id) => Number.isInteger(id) && id > 0)) {
    return NextResponse.json({ error: "Invalid player IDs in picks" }, { status: 400 });
  }

  let gwMeta: { gw: number; season: string; deadline_time: string };
  try {
    gwMeta = await resolveSubmissionGw(
      body.gw != null ? Number(body.gw) : undefined,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Submissions closed";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const supa = getServerSupabase();
  const { data: players, error: pErr } = await supa
    .from("players_static")
    .select(MINI_PLAYER_DISPLAY_COLS)
    .in("fpl_id", pickIds);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const byId = new Map(
    (players ?? []).map((p) => [
      p.fpl_id as number,
      rowToMiniPlayerDisplay(p as Record<string, unknown>),
    ]),
  );

  if (byId.size !== 5) {
    const missing = pickIds.filter((id) => !byId.has(id));
    return NextResponse.json(
      { error: `Unknown player IDs: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const pickInputs: MiniPickInput[] = pickIds.map((id) => {
    const p = byId.get(id)!;
    return {
      fpl_id: id,
      position: p.position,
      team_id: p.team_id,
      web_name: p.web_name,
    };
  });

  const squadIssues = validateMiniSquad(pickInputs);
  const capIssues = validateCaptaincy(pickInputs, captainFplId, viceFplId);
  const allIssues = [...squadIssues, ...capIssues];
  if (allIssues.length > 0) {
    return NextResponse.json(
      { error: "Squad validation failed", issues: allIssues },
      { status: 400 },
    );
  }

  const picksStored: MiniPickStored[] = pickIds.map((id) => byId.get(id)!);
  const unlock: MiniBadgeId[] = ["first_squad", "gw_ready"];
  if (body.used_template) unlock.push("template_starter");

  try {
    const hot = await getMiniHotPicks(gwMeta.gw, 8);
    const topOwned = hot.picks.slice(0, 5).map((p) => p.fpl_id);
    if (topOwned.includes(captainFplId)) {
      unlock.push("hot_captain");
    }
  } catch {
    // Hot picks optional for badge unlock
  }

  let newlyUnlocked: MiniBadgeId[] = unlock;
  if (profileId) {
    const { data: existing, error: readProfErr } = await supa
      .from("mini_profiles")
      .select("badges")
      .eq("id", profileId)
      .maybeSingle();

    if (!readProfErr) {
      const prev = (existing?.badges as string[] | null) ?? [];
      const badges = mergeBadges(prev, unlock);
      newlyUnlocked = unlock.filter((id) => !prev.includes(id));
      const { error: profErr } = await supa.from("mini_profiles").upsert(
        {
          id: profileId,
          nickname: nickname ?? "Manager",
          fpl_entry_id: entryId > 0 ? entryId : null,
          badges,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
      if (profErr && !/schema cache|does not exist|Could not find/i.test(profErr.message)) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }
    }
  }

  const entryName =
    nickname ??
    (typeof body.entry_name === "string" && body.entry_name.trim()
      ? body.entry_name.trim().slice(0, 80)
      : null);

  const baseRow = {
    entry_id: entryId,
    gw: gwMeta.gw,
    season: gwMeta.season,
    entry_name: entryName,
    picks: picksStored,
    captain_fpl_id: captainFplId,
    vice_fpl_id: viceFplId,
    updated_at: new Date().toISOString(),
  };

  let upErr = (
    await supa.from("mini_entries").upsert(
      { ...baseRow, profile_id: profileId || null },
      { onConflict: "entry_id,gw,season" },
    )
  ).error;

  if (upErr && /profile_id|schema cache|does not exist/i.test(upErr.message)) {
    upErr = (
      await supa.from("mini_entries").upsert(baseRow, {
        onConflict: "entry_id,gw,season",
      })
    ).error;
  }

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    entry_id: entryId,
    profile_id: profileId || null,
    gw: gwMeta.gw,
    season: gwMeta.season,
    deadline_time: gwMeta.deadline_time,
    picks: picksStored,
    captain_fpl_id: captainFplId,
    vice_fpl_id: viceFplId,
    newly_unlocked: newlyUnlocked,
  });
}
