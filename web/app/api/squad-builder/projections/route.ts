import { NextResponse } from "next/server";
import type { FixtureProjection } from "@/lib/xp";
import { projectPlayers } from "@/lib/xp";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";

function buildByGwStrip(
  fixtures: FixtureProjection[],
  fromGw: number,
  toGw: number,
): { gw: number; opp: string; xp: number }[] {
  const map = new Map<number, { parts: string[]; xp: number }>();
  for (const f of fixtures) {
    if (f.gw < fromGw || f.gw > toGw) continue;
    const tag = `${f.opp_short}${f.home ? "H" : "A"}`;
    const cur = map.get(f.gw);
    if (!cur) {
      map.set(f.gw, { parts: [tag], xp: f.xp_total });
    } else {
      cur.parts.push(tag);
      cur.xp += f.xp_total;
    }
  }
  return Array.from(map.keys())
    .sort((a, b) => a - b)
    .map((gw) => {
      const { parts, xp } = map.get(gw)!;
      return {
        gw,
        opp: parts.join("·"),
        xp: Math.round(xp * 100) / 100,
      };
    });
}

/** Batch xPt projections for Squad Builder browse list (no 15-player minimum). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      playerIds?: number[];
      fromGw?: number;
      horizon?: number;
    };

    const ids = Array.from(
      new Set(
        (body.playerIds ?? [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    );
    if (ids.length === 0) {
      return NextResponse.json({ projections: {}, fromGw: 0, toGw: 0 });
    }
    if (ids.length > 100) {
      return NextResponse.json(
        { error: "At most 100 player ids per request." },
        { status: 400 },
      );
    }

    const horizon = Math.min(Math.max(Number(body.horizon ?? 1) || 1, 1), 8);
    const window = await resolvePlannerProjectionWindow(
      horizon,
      Number(body.fromGw) > 0 ? Number(body.fromGw) : undefined,
    );
    const { currentGw, fromGw, toGw } = window;

    const projections = await projectPlayers(ids, {
      currentGw,
      fromGw,
      toGw,
    });

    const out: Record<
      string,
      {
        xp_total: number;
        xp_next_gw: number;
        by_gw: { gw: number; opp: string; xp: number }[];
      }
    > = {};

    for (const [id, p] of projections) {
      const nextGwXp = p.fixtures
        .filter((f) => f.gw === fromGw)
        .reduce((s, f) => s + f.xp_total, 0);
      out[String(id)] = {
        xp_total: p.xp_total,
        xp_next_gw: Math.round(nextGwXp * 100) / 100,
        by_gw: buildByGwStrip(p.fixtures, fromGw, toGw),
      };
    }

    return NextResponse.json(
      {
        currentGw,
        fromGw,
        toGw,
        horizon: window.horizon,
        projections: out,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Projection failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
