import { NextResponse } from "next/server";
import { computeTopXpByPosition } from "@/lib/planner/top-xp-by-position";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { horizon?: number; fromGw?: number };
    const horizon = Number(body.horizon ?? 5);
    const fromGw = Number(body.fromGw) > 0 ? Number(body.fromGw) : undefined;
    const result = await computeTopXpByPosition(horizon, fromGw);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Top xP failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
