import type { WcNewsItem } from "@/lib/wc/news-feeds";

export type UserPrefRow = {
  user_id: string;
  national_team_code: string | null;
  favorite_leagues: string[];
  fpl_team_id: number | null;
  followed_fpl_player_ids: number[];
  followed_wc_player_ids: number[];
  news_regions: string[];
};

export type MatchContext = {
  wcTeamsByCode: Map<string, { name: string; short_name: string }>;
  fplTeamsById: Map<number, { name: string; short_name: string }>;
  fplPlayersById: Map<number, { web_name: string | null; name: string }>;
  wcPlayersById: Map<number, { name: string }>;
};

function haystack(item: WcNewsItem): string {
  return `${item.title} ${item.summary}`.toLowerCase();
}

function contains(hay: string, needle: string | null | undefined): boolean {
  if (!needle || needle.length < 2) return false;
  return hay.includes(needle.toLowerCase());
}

function regionMatches(
  userRegions: string[],
  articleRegion: string,
): boolean {
  if (userRegions.length === 0 || userRegions.includes("GLOBAL")) return true;
  if (articleRegion === "GLOBAL") return true;
  return userRegions.includes(articleRegion);
}

function leagueMatch(
  pref: UserPrefRow,
  ctx: MatchContext,
  hay: string,
): boolean {
  const leagues = pref.favorite_leagues.length
    ? pref.favorite_leagues
    : ["wc", "epl"];

  let wcHit = false;
  let eplHit = false;

  if (pref.national_team_code) {
    const team = ctx.wcTeamsByCode.get(pref.national_team_code);
    if (team && (contains(hay, team.name) || contains(hay, team.short_name))) {
      wcHit = true;
    }
  }

  for (const id of pref.followed_wc_player_ids) {
    const p = ctx.wcPlayersById.get(id);
    if (p && contains(hay, p.name)) wcHit = true;
  }

  if (pref.fpl_team_id) {
    const team = ctx.fplTeamsById.get(pref.fpl_team_id);
    if (team && (contains(hay, team.name) || contains(hay, team.short_name))) {
      eplHit = true;
    }
  }

  for (const id of pref.followed_fpl_player_ids) {
    const p = ctx.fplPlayersById.get(id);
    if (!p) continue;
    if (contains(hay, p.web_name) || contains(hay, p.name)) eplHit = true;
  }

  const wantsWc = leagues.includes("wc");
  const wantsEpl = leagues.includes("epl");

  if (wantsWc && wantsEpl) return wcHit || eplHit;
  if (wantsWc) return wcHit;
  if (wantsEpl) return eplHit;
  return wcHit || eplHit;
}

export function newsMatchesUser(
  item: WcNewsItem,
  pref: UserPrefRow,
  ctx: MatchContext,
): boolean {
  if (!regionMatches(pref.news_regions, item.region)) return false;

  const hay = haystack(item);
  return leagueMatch(pref, ctx, hay);
}

export function buildNotificationRow(
  userId: string,
  item: WcNewsItem,
): { user_id: string; type: string; title: string; body: string; href: string } {
  return {
    user_id: userId,
    type: "news",
    title: item.title,
    body: item.summary.slice(0, 280) || item.outlet,
    href: item.url,
  };
}
