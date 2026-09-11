import { getServerSupabase } from "@/lib/supabase";
import { isMissingSiteEventsTable } from "@/lib/analytics/store";
import {
  SAMPLE_REPORT_A_HTML_ASSET,
  SAMPLE_REPORT_A_PDF_ASSET,
  SAMPLE_REPORT_B_HTML_ASSET,
  SAMPLE_REPORT_B_PDF_ASSET,
} from "@/lib/billing/founder-pack";

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
