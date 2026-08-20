import { getServerSupabase } from "@/lib/supabase";
import { countScoutByStatus, listDistributionLogs } from "@/lib/scout/store";
import type {
  ScoutArticleStats,
  ScoutEventType,
  ScoutTrialStats,
} from "@/lib/scout/types";

const TRIAL_START = "2026-08-01T00:00:00.000Z";
const TRIAL_END = "2027-01-01T00:00:00.000Z";

export function trialWindow(): { from: string; to: string } {
  return { from: TRIAL_START, to: TRIAL_END };
}

export function monthWindow(now = new Date()): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m, 1)).toISOString();
  const to = new Date(Date.UTC(y, m + 1, 1)).toISOString();
  return { from, to };
}

export function previousMonthWindow(now = new Date()): { from: string; to: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const from = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const to = new Date(Date.UTC(y, m, 1)).toISOString();
  return { from, to };
}

async function countProUsers(): Promise<number> {
  try {
    const supa = getServerSupabase();
    const { count, error } = await supa
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("insights_plan", "premium");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadScoutTrialStats(opts: {
  from: string;
  to: string;
}): Promise<ScoutTrialStats> {
  const supa = getServerSupabase();
  const [{ pending, published, hidden }, dist, pro_users] = await Promise.all([
    countScoutByStatus(),
    listDistributionLogs(opts.from, opts.to),
    countProUsers(),
  ]);

  const { data: eventRows, error: eventError } = await supa
    .from("scout_events")
    .select("article_id,event_type,visitor_id")
    .gte("created_at", opts.from)
    .lt("created_at", opts.to)
    .limit(20000);
  if (eventError) throw new Error(eventError.message);

  const totals: Record<ScoutEventType, number> = {
    pageview: 0,
    click_premium: 0,
    click_team_rater: 0,
    click_original: 0,
    click_qr: 0,
  };
  const uniqueAll = new Set<string>();
  const byArticle = new Map<
    string,
    {
      counts: Record<ScoutEventType, number>;
      visitors: Set<string>;
    }
  >();

  for (const row of eventRows ?? []) {
    const type = row.event_type as ScoutEventType;
    if (!(type in totals)) continue;
    totals[type] += 1;
    if (type === "pageview" && row.visitor_id) uniqueAll.add(String(row.visitor_id));
    const articleId = row.article_id as string | null;
    if (!articleId) continue;
    let bucket = byArticle.get(articleId);
    if (!bucket) {
      bucket = {
        counts: {
          pageview: 0,
          click_premium: 0,
          click_team_rater: 0,
          click_original: 0,
          click_qr: 0,
        },
        visitors: new Set(),
      };
      byArticle.set(articleId, bucket);
    }
    bucket.counts[type] += 1;
    if (type === "pageview" && row.visitor_id) {
      bucket.visitors.add(String(row.visitor_id));
    }
  }

  const articleIds = [...byArticle.keys()];
  const articlesMeta: Array<{
    id: string;
    slug: string;
    title_zh: string;
    title_en: string;
    status: ScoutArticleStats["status"];
  }> = [];
  if (articleIds.length) {
    const { data, error } = await supa
      .from("scout_articles")
      .select("id,slug,title_zh,title_en,status")
      .in("id", articleIds);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      articlesMeta.push({
        id: String(row.id),
        slug: String(row.slug),
        title_zh: String(row.title_zh ?? ""),
        title_en: String(row.title_en ?? ""),
        status: row.status as ScoutArticleStats["status"],
      });
    }
  }

  const { data: publishedRows, error: pubError } = await supa
    .from("scout_articles")
    .select("id,slug,title_zh,title_en,status")
    .eq("status", "published")
    .order("pushed_at", { ascending: false });
  if (pubError) throw new Error(pubError.message);

  const metaById = new Map(articlesMeta.map((a) => [a.id, a]));
  for (const row of publishedRows ?? []) {
    if (!metaById.has(String(row.id))) {
      metaById.set(String(row.id), {
        id: String(row.id),
        slug: String(row.slug),
        title_zh: String(row.title_zh ?? ""),
        title_en: String(row.title_en ?? ""),
        status: "published",
      });
    }
  }

  const articles: ScoutArticleStats[] = [...metaById.values()].map((meta) => {
    const bucket = byArticle.get(meta.id);
    return {
      article_id: meta.id,
      slug: meta.slug,
      title_zh: meta.title_zh,
      title_en: meta.title_en,
      status: meta.status,
      pageviews: bucket?.counts.pageview ?? 0,
      unique_visitors: bucket?.visitors.size ?? 0,
      click_premium: bucket?.counts.click_premium ?? 0,
      click_team_rater: bucket?.counts.click_team_rater ?? 0,
      click_original: bucket?.counts.click_original ?? 0,
      click_qr: bucket?.counts.click_qr ?? 0,
    };
  });

  articles.sort((a, b) => b.pageviews - a.pageviews || a.title_zh.localeCompare(b.title_zh));

  return {
    from: opts.from,
    to: opts.to,
    published_count: published,
    pending_count: pending,
    hidden_count: hidden,
    pageviews: totals.pageview,
    unique_visitors: uniqueAll.size,
    click_premium: totals.click_premium,
    click_team_rater: totals.click_team_rater,
    click_original: totals.click_original,
    click_qr: totals.click_qr,
    distribution_count: dist.length,
    pro_users,
    top_articles: articles.slice(0, 8),
    articles,
  };
}
