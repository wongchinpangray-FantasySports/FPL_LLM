import { getServerSupabase } from "@/lib/supabase";
import { isMissingSiteEventsTable } from "@/lib/analytics/store";
import type {
  SiteActivityStats,
  SiteDailyPoint,
  SiteDeltas,
  SiteEventRow,
  SiteFeature,
  SiteFeatureStat,
  SiteLoginBucket,
  SiteProductCounts,
} from "@/lib/analytics/types";
import { SITE_FEATURES } from "@/lib/analytics/types";

const EVENT_PAGE_SIZE = 1000;
const EVENT_CAP = 40000;
const PROFILE_PAGE_SIZE = 1000;

type ProfileSnap = {
  created_at: string;
  last_login_date: string | null;
  login_days: number;
  fpl_entry_id: number | null;
  onboarding_completed_at: string | null;
  insights_plan: string | null;
};

export function utcDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function rangeWindow(
  days: number,
  now = new Date(),
): { from: string; to: string; days: number } {
  const safeDays = days === 7 || days === 90 ? days : 30;
  const to = now;
  const from = new Date(Date.UTC(
    to.getUTCFullYear(),
    to.getUTCMonth(),
    to.getUTCDate() - (safeDays - 1),
  ));
  return { from: from.toISOString(), to: to.toISOString(), days: safeDays };
}

export function previousRangeWindow(
  days: number,
  now = new Date(),
): { from: string; to: string; days: number } {
  const current = rangeWindow(days, now);
  const start = new Date(current.from);
  const from = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() - current.days,
  ));
  return { from: from.toISOString(), to: current.from, days: current.days };
}

/** Percent change vs the previous equal-length window. Null if there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

const EMPTY_DELTAS: SiteDeltas = {
  pageviews: null,
  unique_visitors: null,
  signed_in_visitors: null,
  avg_views_per_visitor: null,
  new_users: null,
  total_users: null,
  dau: null,
  wau: null,
  mau: null,
  onboarded_users: null,
  fpl_linked_users: null,
  pro_users: null,
  multi_day_visitors: null,
  signup_conversion_rate: null,
  converted_visitors: null,
};

function emptyProducts(): SiteProductCounts {
  return {
    squad_builder_drafts: 0,
    chat_sessions: 0,
    chat_messages: 0,
    mini_entries: 0,
    mini_profiles: 0,
    share_links: 0,
    share_views: 0,
    scout_pageviews: 0,
  };
}

function emptyDays(fromIso: string, days: number): SiteDailyPoint[] {
  const start = utcDay(fromIso);
  if (!start) return [];
  const [y, m, d] = start.split("-").map(Number);
  const out: SiteDailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    out.push({
      date,
      pageviews: 0,
      visitors: 0,
      signed_in: 0,
      new_users: 0,
    });
  }
  return out;
}

function loginBucket(days: number): SiteLoginBucket["bucket"] {
  if (days <= 1) return "1";
  if (days <= 7) return "2_7";
  if (days <= 30) return "8_30";
  return "31_plus";
}

export function aggregateSiteActivity(input: {
  from: string;
  to: string;
  days: number;
  events: SiteEventRow[];
  profiles: ProfileSnap[];
  products: SiteProductCounts;
  truncated: boolean;
  tableMissing: boolean;
}): SiteActivityStats {
  const { from, to, days, events, profiles, products, truncated, tableMissing } =
    input;
  const daily = emptyDays(from, days);
  const dayIndex = new Map(daily.map((row, i) => [row.date, i]));

  const visitorsAll = new Set<string>();
  const signedInVisitors = new Set<string>();
  const visitorDays = new Map<string, Set<string>>();
  const visitorsByDay = new Map<string, Set<string>>();
  const signedByDay = new Map<string, Set<string>>();
  type FeatureAcc = {
    pageviews: number;
    visitors: Set<string>;
    signedIn: Set<string>;
    visitorDays: Map<string, Set<string>>;
    paths: Map<string, { pageviews: number; visitors: Set<string> }>;
    daily: Map<string, { pageviews: number; visitors: Set<string> }>;
  };
  const featureMap = new Map<string, FeatureAcc>();

  function featureAcc(raw: string): FeatureAcc {
    const feature = (SITE_FEATURES as readonly string[]).includes(raw)
      ? raw
      : "other";
    let bucket = featureMap.get(feature);
    if (!bucket) {
      bucket = {
        pageviews: 0,
        visitors: new Set(),
        signedIn: new Set(),
        visitorDays: new Map(),
        paths: new Map(),
        daily: new Map(),
      };
      featureMap.set(feature, bucket);
    }
    return bucket;
  }

  let anonymousPageviews = 0;
  let signedInPageviews = 0;
  /** Cookies that browsed while logged out. */
  const anonVisitorIds = new Set<string>();
  /** Cookies that browsed while signed in (same id persists after signup). */
  const signedVisitorIds = new Set<string>();

  for (const row of events) {
    const day = utcDay(row.created_at);
    const idx = dayIndex.get(day);
    const visitorKey = row.visitor_id || row.user_id || null;
    if (idx != null) daily[idx]!.pageviews += 1;

    if (row.user_id) {
      signedInPageviews += 1;
      signedInVisitors.add(row.user_id);
      if (row.visitor_id) signedVisitorIds.add(row.visitor_id);
      if (day) {
        let signed = signedByDay.get(day);
        if (!signed) {
          signed = new Set();
          signedByDay.set(day, signed);
        }
        signed.add(row.user_id);
      }
    } else {
      anonymousPageviews += 1;
      if (row.visitor_id) anonVisitorIds.add(row.visitor_id);
    }

    if (visitorKey) {
      visitorsAll.add(visitorKey);
      let daysSet = visitorDays.get(visitorKey);
      if (!daysSet) {
        daysSet = new Set();
        visitorDays.set(visitorKey, daysSet);
      }
      if (day) daysSet.add(day);
      if (day) {
        let set = visitorsByDay.get(day);
        if (!set) {
          set = new Set();
          visitorsByDay.set(day, set);
        }
        set.add(visitorKey);
      }
    }

    const bucket = featureAcc(row.feature || "other");
    bucket.pageviews += 1;
    if (visitorKey) {
      bucket.visitors.add(visitorKey);
      if (day) {
        let daysSet = bucket.visitorDays.get(visitorKey);
        if (!daysSet) {
          daysSet = new Set();
          bucket.visitorDays.set(visitorKey, daysSet);
        }
        daysSet.add(day);
      }
    }
    if (row.user_id) bucket.signedIn.add(row.user_id);
    if (day) {
      let dayBucket = bucket.daily.get(day);
      if (!dayBucket) {
        dayBucket = { pageviews: 0, visitors: new Set() };
        bucket.daily.set(day, dayBucket);
      }
      dayBucket.pageviews += 1;
      if (visitorKey) dayBucket.visitors.add(visitorKey);
    }
    const path = (row.path || "/").slice(0, 120) || "/";
    let pathBucket = bucket.paths.get(path);
    if (!pathBucket) {
      pathBucket = { pageviews: 0, visitors: new Set() };
      bucket.paths.set(path, pathBucket);
    }
    pathBucket.pageviews += 1;
    if (visitorKey) pathBucket.visitors.add(visitorKey);
  }

  for (const [day, set] of visitorsByDay) {
    const idx = dayIndex.get(day);
    if (idx != null) daily[idx]!.visitors = set.size;
  }
  for (const [day, set] of signedByDay) {
    const idx = dayIndex.get(day);
    if (idx != null) daily[idx]!.signed_in = set.size;
  }

  const fromDay = utcDay(from);
  const toDay = utcDay(to);
  const today = utcDay(new Date());
  const d7 = utcDay(new Date(Date.now() - 6 * 86400000));
  const d30 = utcDay(new Date(Date.now() - 29 * 86400000));

  let newUsers = 0;
  let onboarded = 0;
  let fplLinked = 0;
  let proUsers = 0;
  let activeToday = 0;
  let active7d = 0;
  let active30d = 0;
  const buckets: Record<SiteLoginBucket["bucket"], number> = {
    "1": 0,
    "2_7": 0,
    "8_30": 0,
    "31_plus": 0,
  };

  for (const p of profiles) {
    const created = utcDay(p.created_at);
    if (created && created >= fromDay && created <= toDay) {
      newUsers += 1;
      const idx = dayIndex.get(created);
      if (idx != null) daily[idx]!.new_users += 1;
    }
    if (p.onboarding_completed_at) onboarded += 1;
    if (p.fpl_entry_id != null) fplLinked += 1;
    if (p.insights_plan === "premium") proUsers += 1;
    const last = p.last_login_date ? String(p.last_login_date).slice(0, 10) : "";
    if (last === today) activeToday += 1;
    if (last && last >= d7) active7d += 1;
    if (last && last >= d30) active30d += 1;
    buckets[loginBucket(p.login_days || 0)] += 1;
  }

  let multiDay = 0;
  let singleDay = 0;
  for (const daysSet of visitorDays.values()) {
    if (daysSet.size >= 2) multiDay += 1;
    else singleDay += 1;
  }

  const uniqueVisitors = visitorsAll.size;
  const totalPageviews = events.length;
  const features: SiteFeatureStat[] = [...featureMap.entries()]
    .map(([feature, bucket]) => {
      const dailyPoints = [...bucket.daily.entries()]
        .map(([date, point]) => ({
          date,
          pageviews: point.pageviews,
          visitors: point.visitors.size,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
      let peak_date: string | null = null;
      let peak_pageviews = 0;
      for (const point of dailyPoints) {
        if (point.pageviews > peak_pageviews) {
          peak_pageviews = point.pageviews;
          peak_date = point.date;
        }
      }
      let returning = 0;
      for (const daysSet of bucket.visitorDays.values()) {
        if (daysSet.size >= 2) returning += 1;
      }
      return {
        feature: feature as SiteFeature,
        pageviews: bucket.pageviews,
        visitors: bucket.visitors.size,
        signed_in: bucket.signedIn.size,
        returning_visitors: returning,
        avg_views_per_visitor:
          bucket.visitors.size > 0
            ? Math.round((bucket.pageviews / bucket.visitors.size) * 10) / 10
            : 0,
        share_of_pageviews:
          totalPageviews > 0
            ? Math.round((bucket.pageviews / totalPageviews) * 1000) / 10
            : 0,
        peak_date,
        peak_pageviews,
        delta_pageviews: null,
        delta_visitors: null,
        daily: dailyPoints,
        paths: [...bucket.paths.entries()]
          .map(([path, point]) => ({
            path,
            pageviews: point.pageviews,
            visitors: point.visitors.size,
          }))
          .sort(
            (a, b) =>
              b.pageviews - a.pageviews || a.path.localeCompare(b.path),
          )
          .slice(0, 8),
      };
    })
    .sort((a, b) => b.pageviews - a.pageviews || a.feature.localeCompare(b.feature));

  const eventDau = visitorsByDay.get(today)?.size ?? 0;

  let convertedVisitors = 0;
  for (const id of anonVisitorIds) {
    if (signedVisitorIds.has(id)) convertedVisitors += 1;
  }
  const anonymousVisitors = anonVisitorIds.size;
  const signupConversionRate =
    anonymousVisitors > 0
      ? Math.round((convertedVisitors / anonymousVisitors) * 1000) / 10
      : 0;

  return {
    from,
    to,
    days,
    table_missing: tableMissing,
    truncated,
    pageviews: events.length,
    unique_visitors: uniqueVisitors,
    signed_in_visitors: signedInVisitors.size,
    anonymous_pageviews: anonymousPageviews,
    signed_in_pageviews: signedInPageviews,
    anonymous_visitors: anonymousVisitors,
    converted_visitors: convertedVisitors,
    signup_conversion_rate: signupConversionRate,
    multi_day_visitors: multiDay,
    single_day_visitors: singleDay,
    avg_views_per_visitor:
      uniqueVisitors > 0
        ? Math.round((events.length / uniqueVisitors) * 10) / 10
        : 0,
    dau: Math.max(eventDau, activeToday),
    wau: active7d,
    mau: active30d,
    stickiness: 0,
    total_users: profiles.length,
    new_users: newUsers,
    onboarded_users: onboarded,
    fpl_linked_users: fplLinked,
    pro_users: proUsers,
    active_today: activeToday,
    active_7d: active7d,
    active_30d: active30d,
    daily,
    features,
    login_buckets: (["1", "2_7", "8_30", "31_plus"] as const).map((bucket) => ({
      bucket,
      users: buckets[bucket],
    })),
    products,
    deltas: EMPTY_DELTAS,
  };
}

function withStickiness(stats: SiteActivityStats): SiteActivityStats {
  const stickiness =
    stats.active_30d > 0
      ? Math.round((stats.active_today / stats.active_30d) * 100)
      : 0;
  return { ...stats, stickiness };
}

function snapshotBefore(
  profiles: ProfileSnap[],
  cutoffIso: string,
): {
  total: number;
  onboarded: number;
  fplLinked: number;
  pro: number;
  active7d: number;
  active30d: number;
} {
  const cutoff = utcDay(cutoffIso);
  const d7 = utcDay(new Date(Date.parse(cutoffIso) - 6 * 86400000));
  const d30 = utcDay(new Date(Date.parse(cutoffIso) - 29 * 86400000));
  let total = 0;
  let onboarded = 0;
  let fplLinked = 0;
  let pro = 0;
  let active7d = 0;
  let active30d = 0;
  for (const p of profiles) {
    const created = utcDay(p.created_at);
    if (!created || created >= cutoff) continue;
    total += 1;
    if (p.onboarding_completed_at && utcDay(p.onboarding_completed_at) < cutoff) {
      onboarded += 1;
    }
    if (p.fpl_entry_id != null) fplLinked += 1;
    if (p.insights_plan === "premium") pro += 1;
    const last = p.last_login_date ? String(p.last_login_date).slice(0, 10) : "";
    if (last && last < cutoff && last >= d7) active7d += 1;
    if (last && last < cutoff && last >= d30) active30d += 1;
  }
  return { total, onboarded, fplLinked, pro, active7d, active30d };
}

function withFeatureDeltas(
  current: SiteActivityStats,
  previous: SiteActivityStats | null,
): SiteActivityStats {
  if (!previous) return current;
  const prevMap = new Map(previous.features.map((f) => [f.feature, f]));
  return {
    ...current,
    features: current.features.map((f) => {
      const prev = prevMap.get(f.feature);
      return {
        ...f,
        delta_pageviews: percentChange(f.pageviews, prev?.pageviews ?? 0),
        delta_visitors: percentChange(f.visitors, prev?.visitors ?? 0),
      };
    }),
  };
}

function withDeltas(
  current: SiteActivityStats,
  previous: SiteActivityStats | null,
  profiles: ProfileSnap[],
): SiteActivityStats {
  const prior = snapshotBefore(profiles, current.from);
  const prevDay = current.daily.at(-2)?.visitors ?? null;
  const lastDay = current.daily.at(-1)?.visitors ?? null;
  const deltas: SiteDeltas = {
    ...EMPTY_DELTAS,
    total_users: percentChange(current.total_users, prior.total),
    onboarded_users: percentChange(current.onboarded_users, prior.onboarded),
    fpl_linked_users: percentChange(current.fpl_linked_users, prior.fplLinked),
    pro_users: percentChange(current.pro_users, prior.pro),
    wau: percentChange(current.wau, prior.active7d),
    mau: percentChange(current.mau, prior.active30d),
    dau:
      prevDay != null && lastDay != null
        ? percentChange(lastDay, prevDay)
        : null,
  };
  if (!previous) return withFeatureDeltas({ ...current, deltas }, null);
  return withFeatureDeltas(
    {
      ...current,
      deltas: {
        ...deltas,
        pageviews: percentChange(current.pageviews, previous.pageviews),
        unique_visitors: percentChange(
          current.unique_visitors,
          previous.unique_visitors,
        ),
        signed_in_visitors: percentChange(
          current.signed_in_visitors,
          previous.signed_in_visitors,
        ),
        avg_views_per_visitor: percentChange(
          current.avg_views_per_visitor,
          previous.avg_views_per_visitor,
        ),
        new_users: percentChange(current.new_users, previous.new_users),
        multi_day_visitors: percentChange(
          current.multi_day_visitors,
          previous.multi_day_visitors,
        ),
        converted_visitors: percentChange(
          current.converted_visitors,
          previous.converted_visitors,
        ),
        signup_conversion_rate: percentChange(
          current.signup_conversion_rate,
          previous.signup_conversion_rate,
        ),
      },
    },
    previous,
  );
}

async function fetchAllProfiles(): Promise<ProfileSnap[]> {
  const supa = getServerSupabase();
  const out: ProfileSnap[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supa
      .from("profiles")
      .select(
        "created_at,last_login_date,login_days,fpl_entry_id,onboarding_completed_at,insights_plan",
      )
      .order("created_at", { ascending: true })
      .range(offset, offset + PROFILE_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ProfileSnap[];
    out.push(...rows);
    if (rows.length < PROFILE_PAGE_SIZE) break;
    offset += PROFILE_PAGE_SIZE;
    if (offset > 50000) break;
  }
  return out;
}

async function fetchSiteEvents(
  from: string,
  to: string,
): Promise<{ rows: SiteEventRow[]; truncated: boolean; tableMissing: boolean }> {
  const supa = getServerSupabase();
  const rows: SiteEventRow[] = [];
  let offset = 0;
  while (rows.length < EVENT_CAP) {
    const { data, error } = await supa
      .from("site_events")
      .select("created_at,path,feature,visitor_id,user_id")
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1);
    if (error) {
      if (isMissingSiteEventsTable(error)) {
        return { rows: [], truncated: false, tableMissing: true };
      }
      throw new Error(error.message);
    }
    const batch = (data ?? []) as SiteEventRow[];
    rows.push(...batch);
    if (batch.length < EVENT_PAGE_SIZE) {
      return { rows, truncated: false, tableMissing: false };
    }
    offset += EVENT_PAGE_SIZE;
  }
  return { rows, truncated: true, tableMissing: false };
}

async function countTable(
  table: string,
  column = "created_at",
  from?: string,
  to?: string,
): Promise<number> {
  try {
    const supa = getServerSupabase();
    let q = supa.from(table).select("id", { count: "exact", head: true });
    if (from) q = q.gte(column, from);
    if (to) q = q.lt(column, to);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countStar(table: string): Promise<number> {
  try {
    const supa = getServerSupabase();
    const { count, error } = await supa
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function loadProductCounts(
  from: string,
  to: string,
): Promise<SiteProductCounts> {
  const [
    squad_builder_drafts,
    chat_sessions,
    chat_messages,
    mini_entries,
    mini_profiles,
    share_links,
    share_views,
    scout_pageviews,
  ] = await Promise.all([
    countStar("user_squad_builder_drafts"),
    countStar("chat_sessions"),
    countTable("chat_messages", "created_at", from, to),
    countStar("mini_entries"),
    countStar("mini_profiles"),
    countStar("share_links"),
    countStar("share_views"),
    countScoutPageviews(from, to),
  ]);
  return {
    squad_builder_drafts,
    chat_sessions,
    chat_messages,
    mini_entries,
    mini_profiles,
    share_links,
    share_views,
    scout_pageviews,
  };
}

async function countScoutPageviews(from: string, to: string): Promise<number> {
  try {
    const supa = getServerSupabase();
    const { count, error } = await supa
      .from("scout_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "pageview")
      .gte("created_at", from)
      .lt("created_at", to);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function loadSiteActivityStats(opts: {
  days: number;
}): Promise<SiteActivityStats> {
  const window = rangeWindow(opts.days);
  const prev = previousRangeWindow(opts.days);
  const [profiles, events, products, prevEvents] = await Promise.all([
    fetchAllProfiles(),
    fetchSiteEvents(window.from, window.to),
    loadProductCounts(window.from, window.to),
    fetchSiteEvents(prev.from, prev.to),
  ]);
  const current = withStickiness(
    aggregateSiteActivity({
      from: window.from,
      to: window.to,
      days: window.days,
      events: events.rows,
      profiles,
      products,
      truncated: events.truncated,
      tableMissing: events.tableMissing,
    }),
  );
  if (events.tableMissing || prevEvents.tableMissing) {
    return withDeltas(current, null, profiles);
  }
  const previous = aggregateSiteActivity({
    from: prev.from,
    to: prev.to,
    days: prev.days,
    events: prevEvents.rows,
    profiles,
    products: emptyProducts(),
    truncated: prevEvents.truncated,
    tableMissing: prevEvents.tableMissing,
  });
  return withDeltas(current, previous, profiles);
}
