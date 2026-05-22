import { NextResponse } from "next/server";
import type { FixtureProjection } from "@/lib/xp";
import { projectPlayers } from "@/lib/xp";
import { computeTopXpByPosition } from "@/lib/planner/top-xp-by-position";
import { resolvePlannerProjectionWindow } from "@/lib/planner/projection-window";

/** One row per GW (DGW: opponents joined with ·, xP summed). */
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      playerIds?: number[];
      fromGw?: number;
      horizon?: number;
      includeLeagueTops?: boolean;
    };

    const ids = body.playerIds;
    if (!Array.isArray(ids) || ids.length < 15) {
      return NextResponse.json(
        {
          error:
            "playerIds must list at least 15 unique fpl_ids (scenario squad, optionally merged with baseline).",
        },
        { status: 400 },
      );
    }
    const uniq = new Set(ids);
    if (uniq.size !== ids.length) {
      return NextResponse.json(
        { error: "Duplicate players in playerIds." },
        { status: 400 },
      );
    }
    if (ids.length > 30) {
      return NextResponse.json(
        { error: "At most 30 player ids (two full squads)." },
        { status: 400 },
      );
    }

    const horizon = Math.min(Math.max(Number(body.horizon ?? 5) || 5, 1), 8);
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
        xp_per_game: number;
        xp_next_gw: number;
        web_name: string | null;
        position: string | null;
        team: string | null;
        by_gw: { gw: number; opp: string; xp: number }[];
      }
    > = {};
    for (const [id, p] of projections) {
      const nextGwXp = p.fixtures
        .filter((f) => f.gw === fromGw)
        .reduce((s, f) => s + f.xp_total, 0);
      out[String(id)] = {
        xp_total: p.xp_total,
        xp_per_game: p.xp_per_game,
        xp_next_gw: Math.round(nextGwXp * 100) / 100,
        web_name: p.web_name,
        position: p.position,
        team: p.team,
        by_gw: buildByGwStrip(p.fixtures, fromGw, toGw),
      };
    }

    const includeLeagueTops = body.includeLeagueTops !== false;
    let leagueTops = null;
    if (includeLeagueTops) {
      leagueTops = await computeTopXpByPosition(horizon, fromGw);
    }

    return NextResponse.json({
      currentGw,
      fromGw,
      toGw,
      horizon: window.horizon,
      projections: out,
      leagueTops,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Projection failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
