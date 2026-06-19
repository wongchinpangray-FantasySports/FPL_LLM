import { getMiniGameweekContext } from "@/lib/mini/gameweek";
import { ensureWcSeeded } from "@/lib/wc/seed";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";
import { isWcMatchFinished } from "@/lib/wc/fifa-rounds";
import { getWcNewsForApi } from "@/lib/wc/news-store";
import type { WcNewsItem } from "@/lib/wc/news-feeds";
import {
  loadWcTablesData,
  type GroupTable,
  type LeaderboardRow,
} from "@/lib/wc/standings";

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

export type HomeHubData = {
  today: {
    wcNext: HomeMatchSnippet | null;
    fpl: {
      gw: number | null;
      deadline: string | null;
      open: boolean;
    };
    headline: { title: string; url: string; outlet: string } | null;
  };
  wc: {
    nextMatches: HomeMatchSnippet[];
    groupsPreview: GroupTable[];
    topScorers: LeaderboardRow[];
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
  const s = m.status.toLowerCase();
  if (s === "scheduled") return true;
  if (isWcMatchFinished(m)) return false;
  return m.home_score == null;
}

function sortByKickoff(a: WcMatchRow, b: WcMatchRow): number {
  const ta = a.kickoff ? new Date(a.kickoff).getTime() : Infinity;
  const tb = b.kickoff ? new Date(b.kickoff).getTime() : Infinity;
  return ta - tb;
}

async function loadWcHub(): Promise<{
  wc: HomeHubData["wc"];
  wcNext: HomeMatchSnippet | null;
}> {
  await ensureWcSeeded();
  const [{ matches }, tables] = await Promise.all([
    buildWcMatchesWithStats(),
    loadWcTablesData(),
  ]);

  const upcoming = matches.filter(isUpcoming).sort(sortByKickoff);
  const nextMatches = upcoming.slice(0, 3).map(toSnippet);
  const wcNext = upcoming[0] ? toSnippet(upcoming[0]) : null;

  return {
    wcNext,
    wc: {
      nextMatches,
      groupsPreview: tables.groups.slice(0, 3),
      topScorers: tables.scorers.slice(0, 5),
    },
  };
}

export async function loadHomeHubData(): Promise<HomeHubData> {
  const [wcResult, newsResult, fplResult] = await Promise.allSettled([
    loadWcHub(),
    getWcNewsForApi({ limit: 8, editorialOnly: false }),
    getMiniGameweekContext(),
  ]);

  const wcBundle =
    wcResult.status === "fulfilled"
      ? wcResult.value
      : {
          wcNext: null,
          wc: { nextMatches: [], groupsPreview: [], topScorers: [] },
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

  const headline = newsItems[0]
    ? {
        title: newsItems[0].title,
        url: newsItems[0].url,
        outlet: newsItems[0].outlet,
      }
    : null;

  return {
    today: {
      wcNext: wcBundle.wcNext,
      fpl: {
        gw: fplCtx.submission_gw,
        deadline: fplCtx.deadline_time,
        open: fplCtx.submission_open,
      },
      headline,
    },
    wc: wcBundle.wc,
    news: newsItems,
  };
}
