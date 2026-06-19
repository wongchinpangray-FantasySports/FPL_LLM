import { NextResponse } from "next/server";
import {
  buildWcCompare,
  radarLabelsArray,
  buildWcRadarAxes,
  radarAxesToArray,
  type WcComparePlayer,
} from "@/lib/wc/radar";
import {
  buildWcXpRows,
  getWcPlayerById,
  loadAllWcPlayers,
} from "@/lib/wc/data";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";
import {
  displayPlayerName,
  isChineseLocale,
  resolveChinesePlayerNameMap,
} from "@/lib/wc/player-names-zh";

export const dynamic = "force-dynamic";

function comparePlayer(
  p: NonNullable<Awaited<ReturnType<typeof getWcPlayerById>>>,
  pool: Awaited<ReturnType<typeof loadAllWcPlayers>>,
  xpById: Map<number, number>,
): WcComparePlayer {
  return {
    id: p.id,
    name: p.name,
    team_code: p.team_code,
    position: p.position,
    price: p.price,
    selection_pct: p.selection_pct,
    xp_total: xpById.get(p.id) ?? 0,
    fpl_linked: p.fpl_id != null,
    raw: {
      xg: p.xg,
      xa: p.xa,
      form: p.form,
      goals: p.goals,
      assists: p.assists,
    },
    values: radarAxesToArray(buildWcRadarAxes(p, pool)),
  };
}

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const url = new URL(req.url);
    const aId = Number(url.searchParams.get("a"));
    const bId = Number(url.searchParams.get("b"));

    if (!Number.isFinite(aId) || aId <= 0) {
      return NextResponse.json({ error: "Missing player id ?a=" }, { status: 400 });
    }

    const [pool, xp] = await Promise.all([loadAllWcPlayers(), buildWcXpRows()]);
    const xpById = new Map(xp.rows.map((r) => [r.id, r.xp_total]));

    const playerA = await getWcPlayerById(aId);
    if (!playerA) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (!Number.isFinite(bId) || bId <= 0) {
      let player = comparePlayer(playerA, pool, xpById);
      if (isChineseLocale(locale)) {
        const zhMap = await resolveChinesePlayerNameMap([player.name]);
        player = {
          ...player,
          name: displayPlayerName(player.name, locale, zhMap),
        };
      }
      return NextResponse.json({
        player,
        labels: radarLabelsArray(),
      });
    }

    const playerB = await getWcPlayerById(bId);
    if (!playerB) {
      return NextResponse.json({ error: "Compare player not found" }, { status: 404 });
    }

    const result = buildWcCompare(playerA, playerB, pool, xpById);
    if (isChineseLocale(locale)) {
      const zhMap = await resolveChinesePlayerNameMap([
        result.playerA.name,
        result.playerB.name,
      ]);
      return NextResponse.json({
        ...result,
        playerA: {
          ...result.playerA,
          name: displayPlayerName(result.playerA.name, locale, zhMap),
        },
        playerB: {
          ...result.playerB,
          name: displayPlayerName(result.playerB.name, locale, zhMap),
        },
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
