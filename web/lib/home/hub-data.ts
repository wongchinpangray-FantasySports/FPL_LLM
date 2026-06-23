import { unstable_cache } from "next/cache";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import {
  loadWcMatchesForDisplay,
} from "@/lib/wc/match-stats-store";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import {
  buildGroupTablesFromFifaMatches,
  buildLeaderboardsFromFifaMatches,
  loadTeamsByCode,
} from "@/lib/wc/fifa-standings";
import { localizeLeaderboardRows } from "@/lib/wc/localize-players";
import type { GroupTable, LeaderboardRow } from "@/lib/wc/standings";

export type HomeMatchSnippet = {
  id: number;
  home_code: string;
  away_code: string;
  home_name: string;
  away_name: string;
  kickoff: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  round_label: string;
};

export type TodayTickerItem = {
  kind: "result" | "upcoming";
  match: HomeMatchSnippet;
};

export type HomeHubData = {
  today: {
    ticker: TodayTickerItem[];
    fpl: {
      gw: number | null;
      deadline: string | null;
      open: boolean;
    };
  };
  wc: {
    nextMatches: HomeMatchSnippet[];
    groupsPreview: GroupTable[];
    topScorers: LeaderboardRow[];
    topAssists: LeaderboardRow[];
  };
  news: WcNewsItem[];
};

function toSnippet(m: WcMatchRow): HomeMatchSnippet {
  return {
    id: m.id,
    home_code: m.home_code,
    away_code: m.away_code,
    home_name: m.home_name,
    away_name: m.away_name,
    kickoff: m.kickoff,
    status: m.status,
    home_score: m.home_score,
    away_score: m.away_score,
    round_label: m.round_label,
  };
}

function isUpcoming(m: WcMatchRow): boolean {
  if (isWcMatchFinished(m)) return false;
  const s = m.status.toLowerCase();
  return (
    s === "scheduled" ||
    s === "not started" ||
    m.home_score == null
  );
}

function kickoffMs(m: WcMatchRow): number {
  return m.kickoff ? new Date(m.kickoff).getTime() : 0;
}

export function buildTodayTicker(matches: WcMatchRow[]): TodayTickerItem[] {
  const finished = matches
    .filter(
      (m) =>
        isWcMatchFinished(m) &&
        m.home_score != null &&
        m.away_score != null,
    )
    .sort((a, b) => kickoffMs(b) - kickoffMs(a))
    .slice(0, 10)
    .map((m) => ({ kind: "result" as const, match: toSnippet(m) }));

  const upcoming = matches
    .filter(isUpcoming)
    .sort((a, b) => kickoffMs(a) - kickoffMs(b))
    .slice(0, 10)
    .map((m) => ({ kind: "upcoming" as const, match: toSnippet(m) }));

  return [...finished, ...upcoming];
}

async function loadWcHub(locale = "en"): Promise<HomeHubData["wc"] & { ticker: TodayTickerItem[] }> {
  const [matches, teamsByCode] = await Promise.all([
    loadWcMatchesForDisplay(),
    loadTeamsByCode(),
  ]);

  const groups = buildGroupTablesFromFifaMatches(teamsByCode, matches);
  const { scorers, assists } = buildLeaderboardsFromFifaMatches(
    teamsByCode,
    matches,
  );

  const upcoming = matches.filter(isUpcoming).sort((a, b) => kickoffMs(a) - kickoffMs(b));

  const [topScorers, topAssists] = await Promise.all([
    localizeLeaderboardRows(scorers.slice(0, 5), locale),
    localizeLeaderboardRows(assists.slice(0, 5), locale),
  ]);

  return {
    ticker: buildTodayTicker(matches),
    nextMatches: upcoming.slice(0, 3).map(toSnippet),
    groupsPreview: groups.slice(0, 3),
    topScorers,
    topAssists,
  };
}

export async function loadHomeHubData(locale = "en"): Promise<HomeHubData> {
  const [wcResult, newsResult, fplResult] = await Promise.allSettled([
    loadWcHub(locale),
    getWcNewsForApi({ limit: 8, editorialOnly: false, category: "trending" }),
    getMiniGameweekContext(),
  ]);

  const wcBundle =
    wcResult.status === "fulfilled"
      ? wcResult.value
      : {
          ticker: [],
          nextMatches: [],
          groupsPreview: [],
          topScorers: [],
          topAssists: [],
        };

  const newsItems =
    newsResult.status === "fulfilled" ? newsResult.value.items.slice(0, 6) : [];

  const fplCtx =
    fplResult.status === "fulfilled"
      ? fplResult.value
      : {
          submission_gw: null,
          submission_open: false,
          deadline_time: null,
        };

  return {
    today: {
      ticker: wcBundle.ticker,
      fpl: {
        gw: fplCtx.submission_gw,
        deadline: fplCtx.deadline_time,
        open: fplCtx.submission_open,
      },
    },
    wc: {
      nextMatches: wcBundle.nextMatches,
      groupsPreview: wcBundle.groupsPreview,
      topScorers: wcBundle.topScorers,
      topAssists: wcBundle.topAssists,
    },
    news: newsItems,
  };
}

export function loadHomeHubDataCached(locale: string): Promise<HomeHubData> {
  return unstable_cache(
    () => loadHomeHubData(locale),
    ["home-hub", locale],
    { revalidate: 90 },
  )();
}
