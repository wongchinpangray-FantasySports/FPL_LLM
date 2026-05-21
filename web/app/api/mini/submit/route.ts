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

export const dynamic = "force-dynamic";

interface SubmitBody {
  entry_id?: number;
  entry_name?: string;
  gw?: number;
  picks?: number[];
  captain_fpl_id?: number;
  vice_fpl_id?: number;
}

export async function POST(req: Request) {
  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const entryId = Number(body.entry_id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "Valid entry_id is required" }, { status: 400 });
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

  const entryName =
    typeof body.entry_name === "string" && body.entry_name.trim()
      ? body.entry_name.trim().slice(0, 80)
      : null;

  const { error: upErr } = await supa.from("mini_entries").upsert(
    {
      entry_id: entryId,
      gw: gwMeta.gw,
      season: gwMeta.season,
      entry_name: entryName,
      picks: picksStored,
      captain_fpl_id: captainFplId,
      vice_fpl_id: viceFplId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "entry_id,gw,season" },
  );

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    entry_id: entryId,
    gw: gwMeta.gw,
    season: gwMeta.season,
    deadline_time: gwMeta.deadline_time,
    picks: picksStored,
    captain_fpl_id: captainFplId,
    vice_fpl_id: viceFplId,
  });
}
