/**
 * Daily inbox push: match wc_news_cache + match results to user_preferences.
 * Intended for GitHub Actions at 07:00 Asia/Shanghai (23:00 UTC).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getServerSupabase } from "../lib/supabase";
import { loadWcNewsFromDb } from "../lib/wc/news-store";
import type { WcNewsItem } from "../lib/wc/news-feeds";
import {
  buildNotificationRow,
  newsMatchesUser,
  type UserPrefRow,
} from "../lib/notifications/match-news";
import {
  buildFplMatchNotification,
  buildWcMatchNotification,
  fplMatchMatchesUser,
  notificationDedupeKey,
  wcMatchMatchesUser,
  type FplMatchResultRow,
  type WcMatchResultRow,
} from "../lib/notifications/match-results";
import {
  insertNotifications,
  loadMatchContext,
  loadRecentDedupeKeys,
  loadUserPreferences,
  type NotificationInsert,
} from "../lib/notifications/shared";

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;
const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEDUPE_MS = 36 * 60 * 60 * 1000;

function recentNews(items: WcNewsItem[]): WcNewsItem[] {
  const cutoff = Date.now() - NEWS_WINDOW_MS;
  return items.filter((item) => {
    if (!item.published_at) return true;
    const ts = Date.parse(item.published_at);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

function isFinishedWcStatus(status: string): boolean {
  const s = status.toLowerCase();
  return (
    s.includes("finish") ||
    s.includes("complete") ||
    s.includes("played") ||
    s === "ft"
  );
}

async function loadRecentWcMatches(
  sinceIso: string,
): Promise<WcMatchResultRow[]> {
  const admin = getServerSupabase();
  const { data, error } = await admin
    .from("wc_match_stats")
    .select(
      "fifa_tournament_id,home_code,away_code,home_name,away_name,home_score,away_score,home_scorers,away_scorers,kickoff,updated_at,status,summary_json",
    )
    .not("home_score", "is", null)
    .not("away_score", "is", null)
    .gte("updated_at", sinceIso);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((row) => isFinishedWcStatus(String(row.status ?? "")))
    .map((row) => ({
      id: row.fifa_tournament_id as number,
      home_code: row.home_code as string,
      away_code: row.away_code as string,
      home_name: row.home_name as string,
      away_name: row.away_name as string,
      home_score: row.home_score as number,
      away_score: row.away_score as number,
      home_scorers: (row.home_scorers as string | null) ?? null,
      away_scorers: (row.away_scorers as string | null) ?? null,
      kickoff: (row.kickoff as string | null) ?? null,
      updated_at: (row.updated_at as string | null) ?? null,
      summary_json: (row.summary_json as Record<string, string> | null) ?? null,
    }));
}

async function loadRecentFplFixtures(
  sinceIso: string,
): Promise<FplMatchResultRow[]> {
  const admin = getServerSupabase();
  const { data, error } = await admin
    .from("fixtures")
    .select(
      "id,home_team_id,away_team_id,home_team_score,away_team_score,kickoff_time,finished,home:teams!fixtures_home_team_id_fkey(name,short_name),away:teams!fixtures_away_team_id_fkey(name,short_name)",
    )
    .eq("finished", true)
    .gte("kickoff_time", sinceIso);

  if (error) {
    // Fallback without explicit FK names (Supabase join alias varies)
    const fallback = await admin
      .from("fixtures")
      .select(
        "id,home_team_id,away_team_id,home_team_score,away_team_score,kickoff_time,finished",
      )
      .eq("finished", true)
      .gte("kickoff_time", sinceIso);
    if (fallback.error) throw new Error(fallback.error.message);

    const teamIds = new Set<number>();
    for (const row of fallback.data ?? []) {
      teamIds.add(row.home_team_id as number);
      teamIds.add(row.away_team_id as number);
    }
    const { data: teams } = await admin
      .from("teams")
      .select("id,name,short_name")
      .in("id", [...teamIds]);
    const byId = new Map(
      (teams ?? []).map((t) => [
        t.id as number,
        { name: t.name as string, short_name: t.short_name as string },
      ]),
    );

    return (fallback.data ?? [])
      .filter(
        (row) =>
          row.home_team_score != null && row.away_team_score != null,
      )
      .map((row) => {
        const home = byId.get(row.home_team_id as number);
        const away = byId.get(row.away_team_id as number);
        return {
          id: row.id as number,
          home_team_id: row.home_team_id as number,
          away_team_id: row.away_team_id as number,
          home_name: home?.name ?? "Home",
          away_name: away?.name ?? "Away",
          home_short: home?.short_name ?? "HOM",
          away_short: away?.short_name ?? "AWY",
          home_score: row.home_team_score as number,
          away_score: row.away_team_score as number,
          kickoff_time: (row.kickoff_time as string | null) ?? null,
        };
      });
  }

  return (data ?? [])
    .filter(
      (row) => row.home_team_score != null && row.away_team_score != null,
    )
    .map((row) => {
      const homeRaw = row.home as
        | { name: string; short_name: string }
        | { name: string; short_name: string }[]
        | null;
      const awayRaw = row.away as
        | { name: string; short_name: string }
        | { name: string; short_name: string }[]
        | null;
      const home = Array.isArray(homeRaw) ? homeRaw[0] : homeRaw;
      const away = Array.isArray(awayRaw) ? awayRaw[0] : awayRaw;
      return {
        id: row.id as number,
        home_team_id: row.home_team_id as number,
        away_team_id: row.away_team_id as number,
        home_name: home?.name ?? "Home",
        away_name: away?.name ?? "Away",
        home_short: home?.short_name ?? "HOM",
        away_short: away?.short_name ?? "AWY",
        home_score: row.home_team_score as number,
        away_score: row.away_team_score as number,
        kickoff_time: (row.kickoff_time as string | null) ?? null,
      };
    });
}

function trackSeen(seen: Set<string>, userId: string, href: string): boolean {
  const key = notificationDedupeKey(userId, href);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  return true;
}

async function main() {
  const admin = getServerSupabase();
  const since = new Date(Date.now() - MATCH_WINDOW_MS).toISOString();
  const dedupeSince = new Date(Date.now() - DEDUPE_MS).toISOString();

  const prefs = await loadUserPreferences(admin);
  if (!prefs.length) {
    console.log("No user preferences — skipping.");
    return;
  }

  const ctx = await loadMatchContext(admin);
  const seen = await loadRecentDedupeKeys(admin, dedupeSince, [
    "news",
    "match_result",
  ]);

  const toInsert: NotificationInsert[] = [];

  const { items } = await loadWcNewsFromDb();
  const news = recentNews(items);
  for (const pref of prefs as UserPrefRow[]) {
    for (const item of news) {
      if (!newsMatchesUser(item, pref, ctx)) continue;
      if (!trackSeen(seen, pref.user_id, item.url)) continue;
      toInsert.push(buildNotificationRow(pref.user_id, item));
    }
  }

  const wcMatches = await loadRecentWcMatches(since);
  for (const pref of prefs as UserPrefRow[]) {
    for (const match of wcMatches) {
      if (!wcMatchMatchesUser(match, pref, ctx)) continue;
      const row = buildWcMatchNotification(pref.user_id, match);
      if (!trackSeen(seen, pref.user_id, row.href)) continue;
      toInsert.push(row);
    }
  }

  const fplMatches = await loadRecentFplFixtures(since);
  for (const pref of prefs as UserPrefRow[]) {
    for (const match of fplMatches) {
      if (!fplMatchMatchesUser(match, pref, ctx)) continue;
      const row = buildFplMatchNotification(pref.user_id, match);
      if (!trackSeen(seen, pref.user_id, row.href)) continue;
      toInsert.push(row);
    }
  }

  if (toInsert.length === 0) {
    console.log(
      `Daily push: ${news.length} news, ${wcMatches.length} WC + ${fplMatches.length} FPL results — no new matches for ${prefs.length} users.`,
    );
    return;
  }

  const inserted = await insertNotifications(admin, toInsert);
  console.log(
    `Daily push: inserted ${inserted} notification(s) for ${prefs.length} users (${news.length} news, ${wcMatches.length} WC, ${fplMatches.length} FPL in window).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
