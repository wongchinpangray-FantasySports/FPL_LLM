import { unstable_cache } from "next/cache";
import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import {
  loadWcMatchesForDisplay,
} from "@/lib/wc/match-stats-store";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import { filterFplXThisWeek, sortFplXItems } from "@/lib/fpl/fpl-x-feed";
import {
  loadFplXDigestFromDb,
  londonDigestDateIso,
} from "@/lib/fpl/fpl-x-digest";
import {
  buildGroupTablesFromFifaMatches,
  buildLeaderboardsFromFifaMatches,
  loadTeamsByCode,
} from "@/lib/wc/fifa-standings";
import {
  localizeGroupTables,
  localizeHomeMatchSnippets,
  localizeLeaderboardRows,
} from "@/lib/wc/localize-players";
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

export type HomeFplDailyTeaser = {
  digest_date: string;
  summary: string;
  source_count: number;
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
  transferNews: WcNewsItem[];
  eplNews: WcNewsItem[];
  fplTweets: WcNewsItem[];
  fplDailyDigest: HomeFplDailyTeaser | null;
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

  const groups = localizeGroupTables(
    buildGroupTablesFromFifaMatches(teamsByCode, matches),
    locale,
  );
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
    ticker: buildTodayTicker(matches).map((item) => ({
      ...item,
      match: localizeHomeMatchSnippets([item.match], locale)[0]!,
    })),
    nextMatches: localizeHomeMatchSnippets(
      upcoming.slice(0, 3).map(toSnippet),
      locale,
    ),
    groupsPreview: groups,
    topScorers,
    topAssists,
  };
}

function pickFplTweets(sources: WcNewsItem[][], limit = 8): WcNewsItem[] {
  const seen = new Set<string>();
  const out: WcNewsItem[] = [];
  for (const items of sources) {
    for (const item of items) {
      if (item.feed_id !== "fpl-x") continue;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return sortFplXItems(filterFplXThisWeek(out, { fallbackToAll: true })).slice(
    0,
    limit,
  );
}

async function loadFplDailyTeaser(
  locale: string,
): Promise<HomeFplDailyTeaser | null> {
  const digest = await loadFplXDigestFromDb(londonDigestDateIso());
  if (!digest?.summary_en) return null;
  const summary =
    locale.toLowerCase().startsWith("zh") && digest.summary_zh
      ? digest.summary_zh
      : digest.summary_en;
  return {
    digest_date: digest.digest_date,
    summary,
    source_count: digest.source_items.length,
  };
}

export async function loadHomeHubData(locale = "en"): Promise<HomeHubData> {
  const [wcResult, newsResult, transferResult, eplNewsResult, fplResult, digestResult] =
    await Promise.allSettled([
      loadWcHub(locale),
      getWcNewsForApi({ limit: 10, editorialOnly: false, category: "trending" }),
      getWcNewsForApi({ limit: 8, editorialOnly: false, category: "transfer" }),
      getWcNewsForApi({ limit: 12, editorialOnly: false, category: "epl" }),
      getMiniGameweekContext(),
      loadFplDailyTeaser(locale),
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
    newsResult.status === "fulfilled" ? newsResult.value.items.slice(0, 8) : [];

  const transferItems =
    transferResult.status === "fulfilled"
      ? transferResult.value.items
          .filter((i) => i.feed_id !== "fpl-x")
          .slice(0, 5)
      : [];

  const eplNewsItems =
    eplNewsResult.status === "fulfilled"
      ? eplNewsResult.value.items
          .filter((i) => i.feed_id !== "fpl-x")
          .slice(0, 12)
      : newsItems;

  const fplTweetItems = pickFplTweets([
    newsResult.status === "fulfilled" ? newsResult.value.items : [],
    transferResult.status === "fulfilled" ? transferResult.value.items : [],
    eplNewsResult.status === "fulfilled" ? eplNewsResult.value.items : [],
  ]);

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
    transferNews: transferItems,
    eplNews: eplNewsItems,
    fplTweets: fplTweetItems,
    fplDailyDigest:
      digestResult.status === "fulfilled" ? digestResult.value : null,
  };
}

/** Home hub only needs FPL deadline + news — skip WC match/standings work (Worker CPU). */
export async function loadHomeHubDataLite(locale = "en"): Promise<HomeHubData> {
  const [newsResult, fplResult, digestResult] = await Promise.allSettled([
    getWcNewsForApi({ limit: 150, editorialOnly: false, category: "ALL" }),
    getMiniGameweekContext(),
    loadFplDailyTeaser(locale),
  ]);

  const allNews =
    newsResult.status === "fulfilled" ? newsResult.value.items : [];

  const trending = [...allNews]
    .sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    })
    .slice(0, 8);

  const transferItems = allNews
    .filter((i) => i.category === "transfer" && i.feed_id !== "fpl-x")
    .slice(0, 5);

  const eplNewsItems = allNews
    .filter((i) => i.category === "epl" && i.feed_id !== "fpl-x")
    .slice(0, 12);

  const fplTweetItems = pickFplTweets([allNews]);

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
      ticker: [],
      fpl: {
        gw: fplCtx.submission_gw,
        deadline: fplCtx.deadline_time,
        open: fplCtx.submission_open,
      },
    },
    wc: {
      nextMatches: [],
      groupsPreview: [],
      topScorers: [],
      topAssists: [],
    },
    news: trending.length > 0 ? trending : allNews.slice(0, 8),
    transferNews: transferItems,
    eplNews: eplNewsItems.length > 0 ? eplNewsItems : trending,
    fplTweets: fplTweetItems,
    fplDailyDigest:
      digestResult.status === "fulfilled" ? digestResult.value : null,
  };
}

export function loadHomeHubDataCached(locale: string): Promise<HomeHubData> {
  return unstable_cache(
    () => loadHomeHubData(locale),
    ["home-hub", locale],
    { revalidate: 90 },
  )();
}

export function loadHomeHubDataLiteCached(locale: string): Promise<HomeHubData> {
  return unstable_cache(
    () => loadHomeHubDataLite(locale),
    ["home-hub-lite", locale],
    { revalidate: 90 },
  )();
}
