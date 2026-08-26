import { FplAccessError, requireFplEntryAccess } from "@/lib/auth/fpl-access";
import { getServerSupabase } from "@/lib/supabase";
import { fplGet, type FplEntry, type FplHistoryResponse } from "@/lib/fpl";
import { getCachedBootstrapEventAverages } from "@/lib/fpl-bootstrap";
import {
  applyLiveOverallRank,
  historyToRankSeries,
  midpointRank,
  type RankHistoryPoint,
} from "@/lib/fpl-rank-series";
import type { CachedTeam, FplSquadPick } from "@/lib/tools/team";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowLocalPreview(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  );
}

function squadPreview(picks: FplSquadPick[] | undefined) {
  const list = picks ?? [];
  const captain = list.find((p) => p.is_captain);
  const starters = list
    .filter((p) => p.is_starter)
    .map((p) => ({
      fpl_id: p.fpl_id,
      name: p.web_name ?? p.name ?? `#${p.fpl_id}`,
      position: p.position,
      team: p.team,
    }));
  return {
    count: list.length,
    captain: captain?.web_name ?? captain?.name ?? null,
    starters,
    starter_names: starters.map((s) => s.name),
    fpl_ids: list.map((p) => p.fpl_id),
  };
}

type HealthFlag = {
  fpl_id: number;
  web_name: string;
  kind: "injured" | "doubtful" | "suspended" | "unavailable" | "news";
  note: string;
};

async function buildSquadHealth(
  picks: FplSquadPick[] | undefined,
): Promise<{
  status: "good" | "watch" | "alert";
  flags: HealthFlag[];
  available_starters: number;
  starter_count: number;
}> {
  const list = picks ?? [];
  const starters = list.filter((p) => p.is_starter);
  if (list.length === 0) {
    return {
      status: "watch",
      flags: [],
      available_starters: 0,
      starter_count: 0,
    };
  }

  const ids = list.map((p) => p.fpl_id);
  const supa = getServerSupabase();
  const { data: rows } = await supa
    .from("players_static")
    .select("fpl_id,web_name,status,chance_of_playing,news")
    .in("fpl_id", ids);

  const byId = new Map(
    (rows ?? []).map((r) => [Number(r.fpl_id), r] as const),
  );
  const flags: HealthFlag[] = [];

  for (const pick of list) {
    const row = byId.get(pick.fpl_id);
    if (!row) continue;
    const name = String(row.web_name ?? pick.web_name ?? `#${pick.fpl_id}`);
    const status = String(row.status ?? "a");
    const news = String(row.news ?? "").trim();
    const chance =
      typeof row.chance_of_playing === "number"
        ? row.chance_of_playing
        : null;

    if (status === "i") {
      flags.push({
        fpl_id: pick.fpl_id,
        web_name: name,
        kind: "injured",
        note: chance != null ? `${chance}%` : news || "injured",
      });
    } else if (status === "d") {
      flags.push({
        fpl_id: pick.fpl_id,
        web_name: name,
        kind: "doubtful",
        note: chance != null ? `${chance}%` : news || "doubtful",
      });
    } else if (status === "s") {
      flags.push({
        fpl_id: pick.fpl_id,
        web_name: name,
        kind: "suspended",
        note: news || "suspended",
      });
    } else if (status === "u" || status === "n") {
      flags.push({
        fpl_id: pick.fpl_id,
        web_name: name,
        kind: "unavailable",
        note: news || "unavailable",
      });
    } else if (news) {
      flags.push({
        fpl_id: pick.fpl_id,
        web_name: name,
        kind: "news",
        note: news.slice(0, 120),
      });
    }
  }

  const riskIds = new Set(
    flags
      .filter((f) => f.kind !== "news")
      .map((f) => f.fpl_id),
  );
  const available_starters = starters.filter(
    (p) => !riskIds.has(p.fpl_id),
  ).length;
  const alertKinds = flags.filter((f) =>
    ["injured", "suspended", "unavailable"].includes(f.kind),
  ).length;
  const status: "good" | "watch" | "alert" =
    alertKinds > 0 || available_starters < 9
      ? "alert"
      : flags.length > 0
        ? "watch"
        : "good";

  return {
    status,
    flags: flags.slice(0, 8),
    available_starters,
    starter_count: starters.length,
  };
}

function historyPerformance(
  history: FplHistoryResponse | null,
  fallbackAverage: number | null,
) {
  const current = history?.current ?? [];
  const last = current.at(-1) ?? null;
  const prev = current.length >= 2 ? current[current.length - 2] : null;
  const rank_history = historyToRankSeries(current, fallbackAverage);
  return {
    last_gw: last?.event ?? null,
    last_gw_points: last?.points ?? null,
    last_gw_rank: last?.overall_rank ?? null,
    prev_gw_rank: prev?.overall_rank ?? null,
    rank_delta:
      last?.overall_rank != null && prev?.overall_rank != null
        ? prev.overall_rank - last.overall_rank
        : null,
    rank_history,
    average_rank: rank_history.at(-1)?.average_rank ?? fallbackAverage,
  };
}

function rankPayload(
  perf: {
    rank_history: RankHistoryPoint[];
    average_rank: number | null;
  },
  live: {
    event: number | null | undefined;
    overall_rank: number | null | undefined;
  },
  fallbackAverage: number | null,
) {
  const rank_history = applyLiveOverallRank(
    perf.rank_history,
    live,
    fallbackAverage,
  );
  return {
    rank_history,
    average_rank: rank_history.at(-1)?.average_rank ?? perf.average_rank,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { entryId: string } },
) {
  const entryId = Number(params.entryId);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return Response.json({ error: "invalid entry id" }, { status: 400 });
  }

  if (!allowLocalPreview()) {
    try {
      await requireFplEntryAccess(entryId);
    } catch (err) {
      const status = err instanceof FplAccessError ? err.status : 403;
      return Response.json({ error: (err as Error).message }, { status });
    }
  }

  try {
    const supa = getServerSupabase();
    const { data: cached } = await supa
      .from("user_teams")
      .select("raw,fetched_at,picks")
      .eq("entry_id", entryId)
      .maybeSingle();

    const [history, bootstrap] = await Promise.all([
      fplGet<FplHistoryResponse>(`/entry/${entryId}/history/`).catch(
        () => null as FplHistoryResponse | null,
      ),
      getCachedBootstrapEventAverages().catch(() => null),
    ]);
    const fallbackAvg = midpointRank(bootstrap?.total_players);
    const perfHist = historyPerformance(history, fallbackAvg);

    // Prefer cached squad even if slightly stale — home snapshot needs XI + health.
    if (cached?.raw) {
      const team = cached.raw as CachedTeam;
      const picks = (team.picks?.length ? team.picks : cached.picks) as
        | FplSquadPick[]
        | undefined;
      const squad = squadPreview(picks);
      const health = await buildSquadHealth(picks);
      const entryFresh = await fplGet<FplEntry>(`/entry/${entryId}/`).catch(
        () => null as FplEntry | null,
      );
      const entry = entryFresh
        ? {
            ...team.entry,
            summary_overall_points: entryFresh.summary_overall_points,
            summary_overall_rank: entryFresh.summary_overall_rank,
            current_event: entryFresh.current_event,
            name: entryFresh.name ?? team.entry?.name,
          }
        : team.entry;
      return Response.json({
        entry,
        picks_gw: team.picks_gw,
        current_gw: entryFresh?.current_event ?? team.current_gw,
        last_gw: perfHist.last_gw ?? team.current_gw ?? team.picks_gw,
        last_gw_points: perfHist.last_gw_points,
        last_gw_rank: perfHist.last_gw_rank,
        prev_gw_rank: perfHist.prev_gw_rank,
        rank_delta: perfHist.rank_delta,
        ...rankPayload(
          perfHist,
          {
            event: entryFresh?.current_event ?? entry.current_event,
            overall_rank: entry.summary_overall_rank,
          },
          fallbackAvg,
        ),
        bank: team.bank,
        team_value: team.team_value,
        free_transfers: team.free_transfers,
        active_chip: team.active_chip,
        squad,
        health,
        cache_age_ms: cached.fetched_at
          ? Date.now() - new Date(String(cached.fetched_at)).getTime()
          : null,
      });
    }

    const entry = await fplGet<FplEntry>(`/entry/${entryId}/`);
    return Response.json({
      entry: {
        id: entry.id,
        name: entry.name,
        player_first_name: entry.player_first_name,
        player_last_name: entry.player_last_name,
        summary_overall_points: entry.summary_overall_points,
        summary_overall_rank: entry.summary_overall_rank,
        current_event: entry.current_event,
      },
      picks_gw: null,
      current_gw: entry.current_event,
      last_gw: perfHist.last_gw ?? entry.current_event,
      last_gw_points: perfHist.last_gw_points,
      last_gw_rank: perfHist.last_gw_rank,
      prev_gw_rank: perfHist.prev_gw_rank,
      rank_delta: perfHist.rank_delta,
      ...rankPayload(
        perfHist,
        {
          event: entry.current_event,
          overall_rank: entry.summary_overall_rank,
        },
        fallbackAvg,
      ),
      bank: entry.last_deadline_bank != null ? entry.last_deadline_bank / 10 : null,
      team_value:
        entry.last_deadline_value != null
          ? entry.last_deadline_value / 10
          : null,
      free_transfers: null,
      active_chip: null,
      squad: squadPreview(undefined),
      health: {
        status: "watch",
        flags: [],
        available_starters: 0,
        starter_count: 0,
      },
    });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}
