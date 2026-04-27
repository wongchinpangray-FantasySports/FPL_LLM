import { NextResponse } from "next/server";
import {
  nextFixtureForPlayers,
  type NextFixtureOpponent,
} from "@/lib/xp";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { playerIds?: number[] };
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

    const map = await nextFixtureForPlayers(uniq);
    const nextByFplId: Record<string, NextFixtureOpponent | null> = {};
    for (const [id, v] of map) {
      nextByFplId[String(id)] = v;
    }

    return NextResponse.json({ nextByFplId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "next-fixtures failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
