import assert from "node:assert/strict";
import {
  SAMPLE_REPORT_A_HTML_ASSET,
  SAMPLE_REPORT_A_PDF_ASSET,
  SAMPLE_REPORT_B_HTML_ASSET,
  SAMPLE_REPORT_B_PDF_ASSET,
} from "../lib/billing/founder-pack";
import {
  SAMPLE_DAILY_DAYS,
  emptySampleDays,
  rollupProSampleDaily,
  shanghaiYmd,
} from "../lib/billing/pro-sample-funnel";
import { DIAGNOSE_CTA_PATH } from "../lib/billing/founder-pack";

const KNOWN = new Set([
  SAMPLE_REPORT_A_HTML_ASSET,
  SAMPLE_REPORT_A_PDF_ASSET,
  SAMPLE_REPORT_B_HTML_ASSET,
  SAMPLE_REPORT_B_PDF_ASSET,
]);

function main(): void {
  assert.equal(shanghaiYmd("2026-09-29T16:30:00.000Z"), "2026-09-30");
  assert.equal(shanghaiYmd("2026-09-29T15:30:00.000Z"), "2026-09-29");

  const filled = emptySampleDays("2026-09-30", 3);
  assert.deepEqual(
    filled.map((d) => d.date),
    ["2026-09-28", "2026-09-29", "2026-09-30"],
  );
  assert.equal(filled[0]?.pdfClicks, 0);

  const now = new Date("2026-09-30T12:00:00.000Z");
  const daily = rollupProSampleDaily(
    [
      {
        path: SAMPLE_REPORT_A_PDF_ASSET,
        visitor_id: "v1",
        created_at: "2026-09-29T16:10:00.000Z",
      },
      {
        path: SAMPLE_REPORT_A_PDF_ASSET,
        visitor_id: "v1",
        created_at: "2026-09-30T02:00:00.000Z",
      },
      {
        path: SAMPLE_REPORT_B_HTML_ASSET,
        visitor_id: "v2",
        created_at: "2026-09-30T03:00:00.000Z",
      },
      {
        path: DIAGNOSE_CTA_PATH,
        visitor_id: "v5",
        created_at: "2026-09-30T05:00:00.000Z",
      },
      {
        path: DIAGNOSE_CTA_PATH,
        visitor_id: "v5",
        created_at: "2026-09-30T06:00:00.000Z",
      },
      {
        path: "/pro/samples/old.pdf",
        visitor_id: "v3",
        created_at: "2026-09-30T04:00:00.000Z",
      },
      {
        path: SAMPLE_REPORT_B_PDF_ASSET,
        visitor_id: "v4",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    KNOWN,
    now,
    3,
  );

  assert.equal(daily.length, 3);
  assert.equal(daily[0]?.date, "2026-09-28");
  assert.equal(daily[0]?.clicks, 0);
  assert.equal(daily[1]?.date, "2026-09-29");
  assert.equal(daily[1]?.pdfClicks, 0);
  assert.equal(daily[2]?.date, "2026-09-30");
  assert.equal(daily[2]?.pdfClicks, 2);
  assert.equal(daily[2]?.htmlClicks, 1);
  assert.equal(daily[2]?.clicks, 3);
  assert.equal(daily[2]?.visitors, 2);
  assert.equal(daily[2]?.diagnoseClicks, 2);
  assert.equal(daily[2]?.diagnoseVisitors, 1);

  const month = rollupProSampleDaily([], KNOWN, now);
  assert.equal(month.length, SAMPLE_DAILY_DAYS);
  assert.equal(month.at(-1)?.date, "2026-09-30");

  console.log("pro-sample-funnel-self-test: ok");
}

main();
