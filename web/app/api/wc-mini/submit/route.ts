import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { resolveWcSubmissionMatchday } from "@/lib/wc-mini/matchday";
import {
  validateWcCaptaincy,
  validateWcMiniSquad,
  type WcMiniPickInput,
} from "@/lib/wc-mini/validate";
import {
  WC_MINI_PLAYER_COLS,
  rowToWcMiniPlayerDisplay,
  wcPickToStored,
} from "@/lib/wc-mini/player-display";

export const dynamic = "force-dynamic";

interface SubmitBody {
  entry_tag?: string;
  entry_name?: string;
  matchday?: number;
  picks?: number[];
  captain_player_id?: number;
  vice_player_id?: number;
}

function normalizeTag(raw: string | undefined): string | null {
  const tag = raw?.trim().toLowerCase();
  if (!tag || tag.length < 2 || tag.length > 40) return null;
  if (!/^[a-z0-9_-]+$/.test(tag)) return null;
  return tag;
}

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryTag = normalizeTag(body.entry_tag);
  if (!entryTag) {
    return NextResponse.json({ error: "Valid entry_tag is required" }, { status: 400 });
  }

  const pickIds = body.picks;
  if (!Array.isArray(pickIds) || pickIds.length !== 5) {
    return NextResponse.json(
      { error: "picks must be an array of exactly 5 player IDs" },
      { status: 400 },
    );
  }

  const captainId = Number(body.captain_player_id);
  const viceId = Number(body.vice_player_id);
  if (!pickIds.every((id) => Number.isInteger(id) && id > 0)) {
    return NextResponse.json({ error: "Invalid player IDs in picks" }, { status: 400 });
  }

  let mdMeta: { matchday: number; season: string; deadline_time: string };
  try {
    mdMeta = await resolveWcSubmissionMatchday(
      body.matchday != null ? Number(body.matchday) : undefined,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Submissions closed";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const supa = getServerSupabase();
  const { data: players, error: pErr } = await supa
    .from("wc_players")
    .select(WC_MINI_PLAYER_COLS)
    .in("id", pickIds);

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  const byId = new Map(
    (players ?? []).map((p) => [
      p.id as number,
      rowToWcMiniPlayerDisplay(p as Record<string, unknown>),
    ]),
  );

  if (byId.size !== 5) {
    const missing = pickIds.filter((id) => !byId.has(id));
    return NextResponse.json(
      { error: `Unknown player IDs: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const pickInputs: WcMiniPickInput[] = pickIds.map((id) => {
    const p = byId.get(id)!;
    return {
      player_id: id,
      position: p.position,
      wc_team_id: p.team_id,
    };
  });

  const squadIssues = validateWcMiniSquad(pickInputs);
  const capIssues = validateWcCaptaincy(pickInputs, captainId, viceId);
  const allIssues = [...squadIssues, ...capIssues];
  if (allIssues.length > 0) {
    return NextResponse.json(
      { error: "Squad validation failed", issues: allIssues },
      { status: 400 },
    );
  }

  const picksStored = pickIds.map((id) => wcPickToStored(byId.get(id)!));

  const entryName =
    typeof body.entry_name === "string" && body.entry_name.trim()
      ? body.entry_name.trim().slice(0, 80)
      : null;

  const { error: upErr } = await supa.from("wc_mini_entries").upsert(
    {
      entry_tag: entryTag,
      matchday: mdMeta.matchday,
      season: mdMeta.season,
      entry_name: entryName,
      picks: picksStored,
      captain_player_id: captainId,
      vice_player_id: viceId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entry_tag,matchday,season" },
  );

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    entry_tag: entryTag,
    matchday: mdMeta.matchday,
    season: mdMeta.season,
    deadline_time: mdMeta.deadline_time,
    picks: picksStored,
    captain_player_id: captainId,
    vice_player_id: viceId,
  });
}
