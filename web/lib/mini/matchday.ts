/** GW fixture grouping by London calendar day (FPL kickoffs). */

const LONDON = "Europe/London";
/** ~90 min + stoppage + provisional bonus buffer after last kickoff. */
const MATCHDAY_END_BUFFER_MS = 105 * 60 * 1000;

export type MiniFixtureRow = {
  kickoff_time: string | null;
  home_team_id: number;
  away_team_id: number;
  finished: boolean;
};

function londonDateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function yesterdayLondonDateKey(now = new Date()): string {
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return londonDateKey(y);
}

export function formatLondonDateLabel(
  dateKey: string,
  locale: string,
): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Teams with a finished fixture on the given London calendar day. */
export function teamsWithFinishedFixturesOnDate(
  fixtures: MiniFixtureRow[],
  dateKey: string,
): Set<number> {
  const teams = new Set<number>();
  for (const f of fixtures) {
    if (!f.kickoff_time || !f.finished) continue;
    if (londonDateKey(f.kickoff_time) !== dateKey) continue;
    teams.add(f.home_team_id);
    teams.add(f.away_team_id);
  }
  return teams;
}

export type MiniMatchdayRefresh = {
  /** When the client should fetch fresh scores (end of current matchday). */
  next_refresh_at: string | null;
  /** London YYYY-MM-DD for “yesterday”. */
  yesterday_date: string;
  /** Whether any finished fixtures landed on yesterday. */
  yesterday_has_scores: boolean;
  /** All fixtures in the GW are finished. */
  gw_complete: boolean;
};

/**
 * Leaderboard refresh fires once the last kickoff of an in-progress matchday
 * is expected to finish — not on a fixed 45s poll.
 */
export function computeMatchdayRefresh(
  fixtures: MiniFixtureRow[],
  gwComplete: boolean,
  now = new Date(),
): MiniMatchdayRefresh {
  const yesterdayDate = yesterdayLondonDateKey(now);
  const yesterdayTeams = teamsWithFinishedFixturesOnDate(fixtures, yesterdayDate);

  if (gwComplete || fixtures.length === 0) {
    return {
      next_refresh_at: null,
      yesterday_date: yesterdayDate,
      yesterday_has_scores: yesterdayTeams.size > 0,
      gw_complete: gwComplete,
    };
  }

  const byDate = new Map<string, MiniFixtureRow[]>();
  for (const f of fixtures) {
    if (!f.kickoff_time) continue;
    const dk = londonDateKey(f.kickoff_time);
    const list = byDate.get(dk) ?? [];
    list.push(f);
    byDate.set(dk, list);
  }

  const sortedDates = [...byDate.keys()].sort();
  let nextRefreshAt: string | null = null;

  for (const dk of sortedDates) {
    const dayFixtures = byDate.get(dk)!;
    const allFinished = dayFixtures.every((f) => f.finished);
    if (allFinished) continue;

    const lastKickoff = Math.max(
      ...dayFixtures.map((f) => new Date(f.kickoff_time!).getTime()),
    );
    nextRefreshAt = new Date(
      lastKickoff + MATCHDAY_END_BUFFER_MS,
    ).toISOString();
    break;
  }

  return {
    next_refresh_at: nextRefreshAt,
    yesterday_date: yesterdayDate,
    yesterday_has_scores: yesterdayTeams.size > 0,
    gw_complete: false,
  };
}

export function getTeamsPlayedOnDate(
  fixtures: MiniFixtureRow[],
  dateKey: string,
): Set<number> {
  return teamsWithFinishedFixturesOnDate(fixtures, dateKey);
}
