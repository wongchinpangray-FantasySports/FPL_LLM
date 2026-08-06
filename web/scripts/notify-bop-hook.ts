/**
 * One-shot Best of Position engagement push:
 *   1) Write WeChat hook copy (full + short)
 *   2) In-app notifications for all users with preferences
 *   3) Optional WeChat channel push (企微 / PushPlus)
 *
 *   cd web && npx tsx scripts/notify-bop-hook.ts
 *   cd web && npx tsx scripts/notify-bop-hook.ts --band mid-5-0
 *   cd web && npx tsx scripts/notify-bop-hook.ts --dry-run
 *   cd web && npx tsx scripts/notify-bop-hook.ts --skip-app
 *   cd web && npx tsx scripts/notify-bop-hook.ts --skip-wechat
 *
 * Env for WeChat: WECHAT_WORK_WEBHOOK_URL / PUSHPLUS_TOKEN
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import {
  insertNotifications,
  loadRecentDedupeKeys,
  type NotificationInsert,
} from "../lib/notifications/shared";
import { notificationDedupeKey } from "../lib/notifications/match-results";
import { buildWechatBopHook } from "../lib/fpl/wechat-bop-hook";
import { notifyWechatText } from "../lib/fpl/wechat-daily-card";

const DEDUPE_MS = 7 * 24 * 60 * 60 * 1000;
const NOTIFY_TYPE = "insight_bop";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function pushInApp(opts: {
  dryRun: boolean;
  titleZh: string;
  bodyZh: string;
  titleEn: string;
  bodyEn: string;
  hrefZh: string;
  hrefEn: string;
}): Promise<number> {
  const admin = getServerSupabase();
  const { data: prefs, error } = await admin
    .from("user_preferences")
    .select("user_id");
  if (error) throw new Error(error.message);

  const userIds = [...new Set((prefs ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) {
    console.log("In-app: no users with preferences — skip.");
    return 0;
  }

  const sinceIso = new Date(Date.now() - DEDUPE_MS).toISOString();
  const seen = await loadRecentDedupeKeys(admin, sinceIso, [
    NOTIFY_TYPE,
    "insight_value_band",
  ]);

  const rows: NotificationInsert[] = [];
  for (const userId of userIds) {
    const href = opts.hrefZh;
    const key = notificationDedupeKey(userId, href);
    if (key && seen.has(key)) continue;
    rows.push({
      user_id: userId,
      type: NOTIFY_TYPE,
      title: opts.titleZh,
      body: opts.bodyZh,
      href,
    });
  }

  console.log(`In-app: would notify ${rows.length} / ${userIds.length} users`);
  console.log(`  ZH: ${opts.titleZh} — ${opts.bodyZh}`);
  console.log(`  EN: ${opts.titleEn} — ${opts.bodyEn}`);
  console.log(`  Links: ${opts.hrefZh} | ${opts.hrefEn}`);

  if (opts.dryRun) {
    console.log("In-app: dry run — no inserts.");
    return 0;
  }

  const inserted = await insertNotifications(admin, rows);
  console.log(`In-app: inserted ${inserted} notification(s).`);
  return inserted;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipApp = process.argv.includes("--skip-app");
  const skipWechat = process.argv.includes("--skip-wechat");
  const bandId = argValue("--band");

  const outDir = join(process.cwd(), "output", "wechat-bop");
  mkdirSync(outDir, { recursive: true });

  console.log(
    `Building BOP hook${bandId ? ` for ${bandId}` : " (daily rotate)"}${dryRun ? " [dry-run]" : ""}…`,
  );
  const hook = await buildWechatBopHook({
    bandId: bandId || undefined,
    locale: "zh",
  });

  writeFileSync(join(outDir, "hook.json"), JSON.stringify(hook, null, 2), "utf8");
  writeFileSync(join(outDir, "hook.txt"), hook.text_full, "utf8");
  writeFileSync(join(outDir, "hook-short.txt"), hook.text_short, "utf8");
  console.log(`Wrote ${join(outDir, "hook.txt")}`);
  console.log(`Wrote ${join(outDir, "hook-short.txt")}`);
  console.log("\n--- WeChat full ---\n");
  console.log(hook.text_full);
  console.log("\n--- WeChat short ---\n");
  console.log(hook.text_short);
  console.log("");

  const lead = hook.takeaways[0];
  const titleZh = `${hook.title_zh}已更新`;
  const bodyZh = lead
    ? `评估 ${hook.assessed} 人。看点：${lead.blurb_zh} 打开位置精选继续逛同系列。`
    : `评估 ${hook.assessed} 人 — 打开查看完整排名与同系列价位。`;
  const titleEn = `${hook.title_zh} — updated`;
  const bodyEn = lead
    ? `Assessed ${hook.assessed}. Spotlight: ${lead.blurb_en} Browse the full Best of Position series.`
    : `Assessed ${hook.assessed} — open for the full ranking and series.`;

  const pathHrefZh = `/zh/fpl/insights/best-of-position/${hook.band_id}`;
  const pathHrefEn = `/en/fpl/insights/best-of-position/${hook.band_id}`;

  if (!skipApp) {
    await pushInApp({
      dryRun,
      titleZh,
      bodyZh,
      titleEn,
      bodyEn,
      hrefZh: pathHrefZh,
      hrefEn: pathHrefEn,
    });
  } else {
    console.log("In-app: skipped (--skip-app).");
  }

  if (!skipWechat) {
    if (dryRun) {
      console.log("WeChat: dry run — no push.");
    } else {
      const results = await notifyWechatText(
        `位置精选 ${hook.title_zh}`,
        hook.text_full,
      );
      for (const r of results) {
        console.log(
          `WeChat ${r.channel}: ${r.ok ? "ok" : "failed"}${r.detail ? ` — ${r.detail}` : ""}`,
        );
      }
    }
  } else {
    console.log("WeChat: skipped (--skip-wechat).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
