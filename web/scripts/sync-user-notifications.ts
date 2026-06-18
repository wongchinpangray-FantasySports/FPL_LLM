/**
 * Match wc_news_cache articles to user_preferences and insert user_notifications.
 * Run from GitHub Actions after news sync (service-role Supabase).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getServerSupabase } from "../lib/supabase";
import { loadWcNewsFromDb } from "../lib/wc/news-store";
import type { WcNewsItem } from "../lib/wc/news-feeds";
import {
  buildNotificationRow,
  newsMatchesUser,
  type MatchContext,
  type UserPrefRow,
} from "../lib/notifications/match-news";

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

const RECENT_MS = 72 * 60 * 60 * 1000;
const DEDUPE_MS = 24 * 60 * 60 * 1000;

async function loadMatchContext(admin: ReturnType<typeof getServerSupabase>): Promise<MatchContext> {
  const [{ data: wcTeams }, { data: fplTeams }, { data: fplPlayers }, { data: wcPlayers }] =
    await Promise.all([
      admin.from("wc_teams").select("code,name,short_name"),
      admin.from("teams").select("id,name,short_name"),
      admin.from("players_static").select("fpl_id,web_name,name"),
      admin.from("wc_players").select("id,name"),
    ]);

  const wcTeamsByCode = new Map<string, { name: string; short_name: string }>();
  for (const t of wcTeams ?? []) {
    wcTeamsByCode.set(t.code, { name: t.name, short_name: t.short_name });
  }

  const fplTeamsById = new Map<number, { name: string; short_name: string }>();
  for (const t of fplTeams ?? []) {
    fplTeamsById.set(t.id, { name: t.name, short_name: t.short_name });
  }

  const fplPlayersById = new Map<number, { web_name: string | null; name: string }>();
  for (const p of fplPlayers ?? []) {
    fplPlayersById.set(p.fpl_id, { web_name: p.web_name, name: p.name });
  }

  const wcPlayersById = new Map<number, { name: string }>();
  for (const p of wcPlayers ?? []) {
    wcPlayersById.set(p.id, { name: p.name });
  }

  return { wcTeamsByCode, fplTeamsById, fplPlayersById, wcPlayersById };
}

function recentNews(items: WcNewsItem[]): WcNewsItem[] {
  const cutoff = Date.now() - RECENT_MS;
  return items.filter((item) => {
    if (!item.published_at) return true;
    const ts = Date.parse(item.published_at);
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

async function main() {
  const admin = getServerSupabase();
  const { items } = await loadWcNewsFromDb();
  const news = recentNews(items);
  if (news.length === 0) {
    console.log("No recent news items in cache — nothing to match.");
    return;
  }

  const { data: prefs, error: prefErr } = await admin
    .from("user_preferences")
    .select(
      "user_id,national_team_code,favorite_leagues,fpl_team_id,followed_fpl_player_ids,followed_wc_player_ids,news_regions",
    );
  if (prefErr) throw new Error(prefErr.message);
  if (!prefs?.length) {
    console.log("No user preferences — skipping.");
    return;
  }

  const ctx = await loadMatchContext(admin);
  const since = new Date(Date.now() - DEDUPE_MS).toISOString();

  const { data: recentNotifs, error: recentErr } = await admin
    .from("user_notifications")
    .select("user_id,href")
    .gte("created_at", since)
    .eq("type", "news");
  if (recentErr) throw new Error(recentErr.message);

  const seen = new Set<string>();
  for (const n of recentNotifs ?? []) {
    if (n.href) seen.add(`${n.user_id}::${n.href}`);
  }

  const toInsert: ReturnType<typeof buildNotificationRow>[] = [];

  for (const pref of prefs as UserPrefRow[]) {
    for (const item of news) {
      if (!newsMatchesUser(item, pref, ctx)) continue;
      const key = `${pref.user_id}::${item.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      toInsert.push(buildNotificationRow(pref.user_id, item));
    }
  }

  if (toInsert.length === 0) {
    console.log(`Checked ${news.length} articles for ${prefs.length} users — no new matches.`);
    return;
  }

  const { error: insertErr } = await admin.from("user_notifications").insert(toInsert);
  if (insertErr) throw new Error(insertErr.message);

  console.log(
    `Inserted ${toInsert.length} notification(s) from ${news.length} articles for ${prefs.length} users.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
