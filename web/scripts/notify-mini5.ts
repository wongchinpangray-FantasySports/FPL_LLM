/**
 * Mini 5 launch / promo push:
 *   1) In-app inbox for all registered profiles
 *   2) Optional WeChat channel push (企微 / PushPlus)
 *
 *   cd web && npx tsx scripts/notify-mini5.ts
 *   cd web && npx tsx scripts/notify-mini5.ts --dry-run
 *   cd web && npx tsx scripts/notify-mini5.ts --skip-wechat
 *   cd web && npx tsx scripts/notify-mini5.ts --skip-app
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
import { notifyWechatText } from "../lib/fpl/wechat-daily-card";

const DEDUPE_MS = 14 * 24 * 60 * 60 * 1000;
const NOTIFY_TYPE = "promo_mini5";
const HREF_ZH = "/zh/play/mini";
const HREF_EN = "/en/play/mini";

const COPY = {
  zh: {
    title: "Mini 5 上线：5人冲榜，今晚开玩",
    body: "无预算限制，FPL 官方积分。冷门队长可多得 +2 分，完成每周任务解锁徽章。点开立刻组队。",
  },
  en: {
    title: "Mini 5 is live — pick 5 and climb",
    body: "No budget limit. Official FPL points. Captain a ≤10% owned player for +2. Weekly missions & badges await.",
  },
};

const WECHAT_TEXT = [
  "⚽ Mini 5 上线了！",
  "",
  "5人轻量范特西：无预算限制 · FPL官方积分 · 每周任务",
  "常驻奖励：冷门队长出场可多得 +2 Mini 分",
  "",
  "立刻开玩 → https://faleague-ai.com/zh/play/mini",
].join("\n");

async function pushInApp(dryRun: boolean): Promise<number> {
  const admin = getServerSupabase();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id,locale");
  if (error) throw new Error(error.message);

  const users = profiles ?? [];
  if (users.length === 0) {
    console.log("In-app: no profiles — skip.");
    return 0;
  }

  const sinceIso = new Date(Date.now() - DEDUPE_MS).toISOString();
  const seen = await loadRecentDedupeKeys(admin, sinceIso, [NOTIFY_TYPE]);

  const rows: NotificationInsert[] = [];
  for (const u of users) {
    const locale = String(u.locale || "zh").toLowerCase().startsWith("en")
      ? "en"
      : "zh";
    const href = locale === "en" ? HREF_EN : HREF_ZH;
    const copy = locale === "en" ? COPY.en : COPY.zh;
    const key = notificationDedupeKey(u.id as string, href);
    if (key && seen.has(key)) continue;
    rows.push({
      user_id: u.id as string,
      type: NOTIFY_TYPE,
      title: copy.title,
      body: copy.body,
      href,
    });
  }

  console.log(`In-app: would notify ${rows.length} / ${users.length} users`);
  console.log(`  ZH: ${COPY.zh.title} — ${COPY.zh.body}`);
  console.log(`  EN: ${COPY.en.title} — ${COPY.en.body}`);
  console.log(`  Links: ${HREF_ZH} | ${HREF_EN}`);

  if (dryRun) {
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

  const outDir = join(process.cwd(), "output", "mini5-notify");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "inbox.json"),
    JSON.stringify({ type: NOTIFY_TYPE, hrefZh: HREF_ZH, hrefEn: HREF_EN, copy: COPY }, null, 2),
    "utf8",
  );
  writeFileSync(join(outDir, "wechat.txt"), WECHAT_TEXT, "utf8");

  console.log(`Mini 5 promo notify${dryRun ? " [dry-run]" : ""}…`);

  if (!skipApp) {
    await pushInApp(dryRun);
  } else {
    console.log("In-app: skipped (--skip-app).");
  }

  if (!skipWechat) {
    if (dryRun) {
      console.log("WeChat: dry run — no push.");
      console.log("\n--- WeChat preview ---\n");
      console.log(WECHAT_TEXT);
    } else {
      const results = await notifyWechatText("Mini 5 上线", WECHAT_TEXT);
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
