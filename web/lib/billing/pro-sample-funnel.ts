import { getServerSupabase } from "@/lib/supabase";
import { isMissingSiteEventsTable } from "@/lib/analytics/store";
import {
  FOUNDER_PACK_PATH,
  SAMPLE_REPORT_A_HTML_ASSET,
  SAMPLE_REPORT_A_PDF_ASSET,
  SAMPLE_REPORT_B_HTML_ASSET,
  SAMPLE_REPORT_B_PDF_ASSET,
} from "@/lib/billing/founder-pack";
import { insertNotifications } from "@/lib/notifications/shared";

export type ProSampleBucket = {
  key: "a_html" | "a_pdf" | "b_html" | "b_pdf";
  label: string;
  path: string;
  clicks: number;
  visitors: number;
};

export type ProSampleFunnel = {
  tableMissing: boolean;
  clicks: number;
  uniqueVisitors: number;
  htmlClicks: number;
  pdfClicks: number;
  aClicks: number;
  bClicks: number;
  bySample: ProSampleBucket[];
  /** payers / sample visitors × 100 (null if no sample visitors) */
  sampleToPaidRate: number | null;
  /** leads (all statuses except lost?) / sample visitors — use total leads pipeline */
  sampleToLeadRate: number | null;
};

export type ProSampleOpener = {
  userId: string | null;
  visitorId: string | null;
  email: string | null;
  displayName: string | null;
  entryId: number | null;
  premium: boolean;
  lastAt: string;
  clicks: number;
  samples: string[];
};

function sampleLabelFromPath(path: string): string {
  if (path.includes("-a-19") && path.endsWith(".pdf")) return "A · PDF";
  if (path.includes("-a-19") && path.endsWith(".html")) return "A · H5";
  if (path.includes("-b-49") && path.endsWith(".pdf")) return "B · PDF";
  if (path.includes("-b-49") && path.endsWith(".html")) return "B · H5";
  return "sample";
}

function openerKey(userId: string | null, visitorId: string | null): string {
  if (userId) return `u:${userId}`;
  if (visitorId) return `v:${visitorId}`;
  return "unknown";
}

const BUCKETS: Array<{
  key: ProSampleBucket["key"];
  label: string;
  path: string;
}> = [
  { key: "a_html", label: "A · H5", path: SAMPLE_REPORT_A_HTML_ASSET },
  { key: "a_pdf", label: "A · PDF", path: SAMPLE_REPORT_A_PDF_ASSET },
  { key: "b_html", label: "B · H5", path: SAMPLE_REPORT_B_HTML_ASSET },
  { key: "b_pdf", label: "B · PDF", path: SAMPLE_REPORT_B_PDF_ASSET },
];

function pct(num: number, den: number): number | null {
  if (den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

export async function getProSampleFunnel(input: {
  leads: number;
  payers: number;
}): Promise<ProSampleFunnel> {
  const empty: ProSampleFunnel = {
    tableMissing: false,
    clicks: 0,
    uniqueVisitors: 0,
    htmlClicks: 0,
    pdfClicks: 0,
    aClicks: 0,
    bClicks: 0,
    bySample: BUCKETS.map((b) => ({
      ...b,
      clicks: 0,
      visitors: 0,
    })),
    sampleToPaidRate: null,
    sampleToLeadRate: null,
  };

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("site_events")
    .select("path,visitor_id")
    .eq("event_type", "pro_sample")
    .eq("feature", "pro")
    .limit(20000);

  if (error) {
    if (isMissingSiteEventsTable(error)) {
      return { ...empty, tableMissing: true };
    }
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("event_type") || msg.includes("check constraint")) {
      return { ...empty, tableMissing: true };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    path: string | null;
    visitor_id: string | null;
  }>;

  const visitors = new Set<string>();
  const byPath = new Map<string, { clicks: number; visitors: Set<string> }>();
  for (const b of BUCKETS) {
    byPath.set(b.path, { clicks: 0, visitors: new Set() });
  }

  let htmlClicks = 0;
  let pdfClicks = 0;
  let aClicks = 0;
  let bClicks = 0;

  for (const row of rows) {
    const path = row.path ?? "";
    const bucket = byPath.get(path);
    if (!bucket) continue;
    bucket.clicks += 1;
    if (row.visitor_id) {
      visitors.add(row.visitor_id);
      bucket.visitors.add(row.visitor_id);
    }
    if (path.endsWith(".html")) htmlClicks += 1;
    if (path.endsWith(".pdf")) pdfClicks += 1;
    if (path.includes("-a-19")) aClicks += 1;
    if (path.includes("-b-49")) bClicks += 1;
  }

  const uniqueVisitors = visitors.size;
  return {
    tableMissing: false,
    clicks: rows.length,
    uniqueVisitors,
    htmlClicks,
    pdfClicks,
    aClicks,
    bClicks,
    bySample: BUCKETS.map((b) => {
      const s = byPath.get(b.path)!;
      return {
        ...b,
        clicks: s.clicks,
        visitors: s.visitors.size,
      };
    }),
    sampleToPaidRate: pct(input.payers, uniqueVisitors),
    sampleToLeadRate: pct(input.leads, uniqueVisitors),
  };
}

export async function listProSampleOpeners(): Promise<{
  tableMissing: boolean;
  anonymousClicks: number;
  openers: ProSampleOpener[];
}> {
  const empty = { tableMissing: false, anonymousClicks: 0, openers: [] as ProSampleOpener[] };
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("site_events")
    .select("user_id,visitor_id,path,created_at")
    .eq("event_type", "pro_sample")
    .eq("feature", "pro")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    if (isMissingSiteEventsTable(error)) {
      return { ...empty, tableMissing: true };
    }
    const msg = (error.message ?? "").toLowerCase();
    if (msg.includes("event_type") || msg.includes("check constraint")) {
      return { ...empty, tableMissing: true };
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{
    user_id: string | null;
    visitor_id: string | null;
    path: string | null;
    created_at: string;
  }>;

  const byKey = new Map<
    string,
    {
      userId: string | null;
      visitorId: string | null;
      lastAt: string;
      clicks: number;
      samples: Set<string>;
    }
  >();
  let anonymousClicks = 0;

  for (const row of rows) {
    const userId = row.user_id?.trim() || null;
    const visitorId = row.visitor_id?.trim() || null;
    if (!userId) anonymousClicks += 1;
    const key = openerKey(userId, visitorId);
    const label = sampleLabelFromPath(row.path ?? "");
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        userId,
        visitorId,
        lastAt: row.created_at,
        clicks: 1,
        samples: new Set([label]),
      });
      continue;
    }
    existing.clicks += 1;
    existing.samples.add(label);
    if (row.created_at > existing.lastAt) existing.lastAt = row.created_at;
  }

  const userIds = [...new Set([...byKey.values()].map((v) => v.userId).filter(Boolean))] as string[];
  const profileById = new Map<
    string,
    { display_name: string | null; fpl_entry_id: number | null; insights_plan: string | null }
  >();
  for (let i = 0; i < userIds.length; i += 80) {
    const batch = userIds.slice(i, i + 80);
    const { data: profiles, error: pErr } = await supa
      .from("profiles")
      .select("id,display_name,fpl_entry_id,insights_plan")
      .in("id", batch);
    if (pErr) throw new Error(pErr.message);
    for (const p of profiles ?? []) {
      profileById.set(p.id as string, {
        display_name: (p.display_name as string | null) ?? null,
        fpl_entry_id: (p.fpl_entry_id as number | null) ?? null,
        insights_plan: (p.insights_plan as string | null) ?? null,
      });
    }
  }

  const emailById = new Map<string, string>();
  for (const id of userIds) {
    try {
      const { data } = await supa.auth.admin.getUserById(id);
      const email = data.user?.email?.trim();
      if (email) emailById.set(id, email);
    } catch {
      /* skip */
    }
  }

  const openers: ProSampleOpener[] = [...byKey.values()]
    .map((v) => {
      const profile = v.userId ? profileById.get(v.userId) : undefined;
      return {
        userId: v.userId,
        visitorId: v.userId ? null : v.visitorId,
        email: v.userId ? emailById.get(v.userId) ?? null : null,
        displayName: profile?.display_name ?? null,
        entryId: profile?.fpl_entry_id ?? null,
        premium: profile?.insights_plan === "premium",
        lastAt: v.lastAt,
        clicks: v.clicks,
        samples: [...v.samples],
      };
    })
    .sort((a, b) => {
      if (Boolean(a.userId) !== Boolean(b.userId)) return a.userId ? -1 : 1;
      return b.lastAt.localeCompare(a.lastAt);
    });

  return { tableMissing: false, anonymousClicks, openers };
}

const SAMPLE_NUDGE_TYPE = "founder_pack_offer";

export async function nudgeSampleOpenersInbox(): Promise<{
  inserted: number;
  skippedPremium: number;
  skippedNoAccount: number;
}> {
  const { openers } = await listProSampleOpeners();
  const targets = openers.filter((o) => o.userId && !o.premium);
  const skippedNoAccount = openers.filter((o) => !o.userId).length;
  const skippedPremium = openers.filter((o) => o.userId && o.premium).length;
  const ids = [...new Set(targets.map((o) => o.userId!))];
  if (ids.length === 0) {
    return { inserted: 0, skippedPremium, skippedNoAccount };
  }

  const admin = getServerSupabase();
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, error } = await admin
    .from("user_notifications")
    .select("user_id")
    .eq("type", SAMPLE_NUDGE_TYPE)
    .eq("href", FOUNDER_PACK_PATH)
    .gte("created_at", since)
    .in("user_id", ids);
  if (error) throw new Error(error.message);
  const already = new Set((recent ?? []).map((r) => r.user_id as string));

  const rows = ids
    .filter((id) => !already.has(id))
    .map((user_id) => ({
      user_id,
      type: SAMPLE_NUDGE_TYPE,
      title: "报告样本看过了 · 本轮可以开通",
      body: "你打开过参考报告。A ¥9.9 本轮诊断 / B ¥39.9 用到第7轮。点「去开通」留微信号，或微信私信发哥「开通」。Scout 中文继续免费。",
      href: FOUNDER_PACK_PATH,
    }));

  const inserted = await insertNotifications(admin, rows);
  return { inserted, skippedPremium, skippedNoAccount };
}
