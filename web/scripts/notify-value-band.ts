/**
 * Push in-app notifications for a new value-band insight (pilot: £5.0m MIDs).
 *
 *   cd web && npx tsx scripts/notify-value-band.ts
 *   cd web && npx tsx scripts/notify-value-band.ts --dry-run
 */
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import {
  insertNotifications,
  loadRecentDedupeKeys,
  type NotificationInsert,
} from "../lib/notifications/shared";
import { notificationDedupeKey } from "../lib/notifications/match-results";
import { loadMid50ValueBand } from "../lib/fpl/insights/value-bands";

const HREF_ZH = "/zh/fpl/insights/best-of-position/mid-5-0";
const HREF_EN = "/en/fpl/insights/best-of-position/mid-5-0";
const DEDUPE_MS = 7 * 24 * 60 * 60 * 1000;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const analysis = await loadMid50ValueBand();
  const lead = analysis.takeaways[0];
  const leadName = lead?.web_name ?? "budget midfielders";

  const titleZh = "最佳 £5.0m 中场分析已更新";
  const bodyZh = lead
    ? `我们评估了 ${analysis.assessed} 名 £5.0m 中场。看点：${lead.blurb_zh}`
    : `我们评估了 ${analysis.assessed} 名 £5.0m 中场 — 打开查看完整排名。`;

  const titleEn = "Best £5.0m midfielders — new analysis";
  const bodyEn = lead
    ? `We assessed ${analysis.assessed} £5.0m MIDs. Spotlight: ${lead.blurb_en}`
    : `We assessed ${analysis.assessed} £5.0m midfielders — open for the full ranking.`;

  console.log(`Assessed ${analysis.assessed} · top xP: ${leadName}`);
  console.log(`Takeaways: ${analysis.takeaways.map((t) => t.web_name).join(", ")}`);

  const admin = getServerSupabase();
  const { data: prefs, error } = await admin
    .from("user_preferences")
    .select("user_id");
  if (error) throw new Error(error.message);

  const userIds = [...new Set((prefs ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) {
    console.log("No users with preferences — nothing to notify.");
    return;
  }

  const sinceIso = new Date(Date.now() - DEDUPE_MS).toISOString();
  const seen = await loadRecentDedupeKeys(admin, sinceIso, [
    "insight_value_band",
  ]);

  const rows: NotificationInsert[] = [];
  for (const userId of userIds) {
    // Prefer ZH href for now (primary audience); EN available via locale switch on site.
    const href = HREF_ZH;
    const key = notificationDedupeKey(userId, href);
    if (key && seen.has(key)) continue;
    rows.push({
      user_id: userId,
      type: "insight_value_band",
      title: titleZh,
      body: bodyZh,
      href,
    });
    // Also store EN-keyed dedupe via second pass only if different path needed —
    // single notification per user is enough for the pilot.
  }

  console.log(`Would notify ${rows.length} / ${userIds.length} users`);
  console.log(`EN preview: ${titleEn} — ${bodyEn}`);
  console.log(`ZH preview: ${titleZh} — ${bodyZh}`);
  console.log(`Links: ${HREF_ZH} | ${HREF_EN}`);

  if (dryRun) {
    console.log("Dry run — no inserts.");
    return;
  }

  const inserted = await insertNotifications(admin, rows);
  console.log(`Inserted ${inserted} notification(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
