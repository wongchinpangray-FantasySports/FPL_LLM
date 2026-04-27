import { NextResponse } from "next/server";
import { projectPlayers, resolveCurrentGw } from "@/lib/xp";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      playerIds?: number[];
      fromGw?: number;
      horizon?: number;
    };

    const ids = body.playerIds;
    /** Planner sends the union of loaded FPL 15 + scenario 15 so both can be scored after transfers */
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

    const { current } = await resolveCurrentGw();
    const horizon = Math.min(Math.max(Number(body.horizon ?? 5) || 5, 1), 8);
    const fromGw =
      Number(body.fromGw) > 0 ? Number(body.fromGw) : current + 1;
    const toGw = fromGw + horizon - 1;

    const projections = await projectPlayers(ids, {
      currentGw: current,
      fromGw,
      toGw,
    });

    const out: Record<
      string,
      {
        xp_total: number;
        xp_per_game: number;
        web_name: string | null;
        position: string | null;
        team: string | null;
        upcoming_fixtures: Array<{
          gw: number;
          opp_short: string;
          home: boolean;
        }>;
      }
    > = {};
    for (const [id, p] of projections) {
      const upcoming_fixtures = [...p.fixtures]
        .sort((a, b) => a.gw - b.gw || a.fixture_id - b.fixture_id)
        .map((f) => ({
          gw: f.gw,
          opp_short: f.opp_short,
          home: f.home,
        }));
      out[String(id)] = {
        xp_total: p.xp_total,
        xp_per_game: p.xp_per_game,
        web_name: p.web_name,
        position: p.position,
        team: p.team,
        upcoming_fixtures,
      };
    }

    return NextResponse.json({
      currentGw: current,
      fromGw,
      toGw,
      horizon,
      projections: out,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Projection failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
