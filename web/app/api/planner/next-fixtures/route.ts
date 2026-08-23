import { NextResponse } from "next/server";
import {
  nextFixtureForPlayers,
  type NextFixtureOpponent,
} from "@/lib/xp";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      playerIds?: number[];
      /** Optional; defaults to planner next GW (`current + 1`). */
      fromGw?: number;
    };
    const ids = body.playerIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "playerIds must be a non-empty array." },
        { status: 400 },
      );
    }
    const uniq = Array.from(
      new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)),
    );
    if (uniq.length === 0) {
      return NextResponse.json(
        { error: "No valid player ids." },
        { status: 400 },
      );
    }

    const window = await resolvePlannerProjectionWindow(
      1,
      Number(body.fromGw) > 0 ? Number(body.fromGw) : undefined,
    );
    const map = await nextFixtureForPlayers(uniq, { minGw: window.fromGw });
    const nextByFplId: Record<string, NextFixtureOpponent | null> = {};
    for (const [id, v] of map) {
      nextByFplId[String(id)] = v;
    }

    return NextResponse.json({
      nextByFplId,
      fromGw: window.fromGw,
      currentGw: window.currentGw,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "next-fixtures failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
