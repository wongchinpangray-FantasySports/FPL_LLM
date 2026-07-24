import type { UserPrefRow, MatchContext } from "@/lib/notifications/match-news";

export type WcMatchResultRow = {
  id: number;
  home_code: string;
  away_code: string;
  home_name: string;
  away_name: string;
  home_score: number;
  away_score: number;
  home_scorers: string | null;
  away_scorers: string | null;
  kickoff: string | null;
  updated_at: string | null;
  summary_json: Record<string, string> | null;
};

export type FplMatchResultRow = {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_name: string;
  away_name: string;
  home_short: string;
  away_short: string;
  home_score: number;
  away_score: number;
  kickoff_time: string | null;
};

function wantsLeague(pref: UserPrefRow, league: "wc" | "epl"): boolean {
  const leagues = pref.favorite_leagues.length
    ? pref.favorite_leagues
    : ["wc", "epl"];
  return leagues.includes(league);
}

export function wcMatchMatchesUser(
  match: WcMatchResultRow,
  pref: UserPrefRow,
  ctx: MatchContext,
): boolean {
  if (!wantsLeague(pref, "wc")) return false;

  if (
    pref.national_team_code &&
    (match.home_code === pref.national_team_code ||
      match.away_code === pref.national_team_code)
  ) {
    return true;
  }

  const scorerHay = `${match.home_scorers ?? ""} ${match.away_scorers ?? ""}`.toLowerCase();
  for (const id of pref.followed_wc_player_ids) {
    const p = ctx.wcPlayersById.get(id);
    if (p && scorerHay.includes(p.name.toLowerCase())) return true;
  }

  return false;
}

function effectiveFplTeamId(
  pref: UserPrefRow,
  ctx: MatchContext,
): number | null {
  const short = pref.fpl_team_short_name?.trim().toUpperCase();
  if (short) {
    for (const [id, team] of ctx.fplTeamsById) {
      if (team.short_name.toUpperCase() === short) return id;
    }
  }
  return pref.fpl_team_id;
}

export function fplMatchMatchesUser(
  match: FplMatchResultRow,
  pref: UserPrefRow,
  ctx: MatchContext,
): boolean {
  if (!wantsLeague(pref, "epl")) return false;
  const teamId = effectiveFplTeamId(pref, ctx);
  if (!teamId) return false;
  return match.home_team_id === teamId || match.away_team_id === teamId;
}

export function buildWcMatchNotification(
  userId: string,
  match: WcMatchResultRow,
  locale = "en",
): {
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
} {
  const title = `${match.home_name} ${match.home_score}–${match.away_score} ${match.away_name}`;
  const summary =
    match.summary_json?.[locale] ??
    match.summary_json?.en ??
    ([match.home_scorers, match.away_scorers].filter(Boolean).join(" · ") ||
      "Full-time");

  return {
    user_id: userId,
    type: "match_result",
    title,
    body: summary.slice(0, 280),
    href: `/worldcup?match=${match.id}`,
  };
}

export function buildFplMatchNotification(
  userId: string,
  match: FplMatchResultRow,
): {
  user_id: string;
  type: string;
  title: string;
  body: string;
  href: string;
} {
  return {
    user_id: userId,
    type: "match_result",
    title: `${match.home_name} ${match.home_score}–${match.away_score} ${match.away_name}`,
    body: `Premier League · ${match.home_short} vs ${match.away_short}`,
    href: `/players?fixture=${match.id}`,
  };
}

export function notificationDedupeKey(
  userId: string,
  href: string | null,
): string | null {
  if (!href) return null;
  const wc = href.match(/\/worldcup\?match=(\d+)/);
  if (wc) return `${userId}::match:wc:${wc[1]}`;
  const fpl = href.match(/\/players\?fixture=(\d+)/);
  if (fpl) return `${userId}::match:fpl:${fpl[1]}`;
  return `${userId}::${href}`;
}
