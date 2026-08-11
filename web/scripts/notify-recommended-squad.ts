/**
 * Recommended Squad launch / promo push:
 *   1) In-app inbox for all registered profiles
 *   2) Optional WeChat channel push (企微 / PushPlus)
 *
 *   cd web && npx tsx scripts/notify-recommended-squad.ts
 *   cd web && npx tsx scripts/notify-recommended-squad.ts --dry-run
 *   cd web && npx tsx scripts/notify-recommended-squad.ts --skip-wechat
 *   cd web && npx tsx scripts/notify-recommended-squad.ts --skip-app
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
const NOTIFY_TYPE = "promo_recommended_squad";
const HREF_ZH = "/zh/fpl/insights/recommended-squad";
const HREF_EN = "/en/fpl/insights/recommended-squad";

const COPY = {
  zh: {
    title: "推荐阵容上线：点芯片，一次出三套",
    body: "选风格、排除大热、定目标 —— 最稳 / 均衡 / 最差分并排对比，一键导入构建器微调。",
  },
  en: {
    title: "Recommended squad is live",
    body: "Chip a style, exclude big names, get 3 contrastive GW1 squads — open any one in Squad Builder.",
  },
};

const WECHAT_TEXT = [
  "🔥 推荐阵容上线了！",
  "",
  "还在纠结开局 15 人？点几下就出队：",
  "✅ 一次生成 · 最稳 / 均衡 / 最差分 三套对比",
  "✅ 可排除 Haaland、Bruno 等大热",
  "✅ 一键导入阵容构建器微调",
  "",
  "立刻试试 → https://faleague-ai.com/zh/fpl/insights/recommended-squad",
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

  const outDir = join(process.cwd(), "output", "recommended-squad-notify");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "inbox.json"),
    JSON.stringify(
      { type: NOTIFY_TYPE, hrefZh: HREF_ZH, hrefEn: HREF_EN, copy: COPY },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(join(outDir, "wechat.txt"), WECHAT_TEXT, "utf8");

  console.log(`Recommended Squad promo notify${dryRun ? " [dry-run]" : ""}…`);

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
      const results = await notifyWechatText("推荐阵容上线", WECHAT_TEXT);
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
