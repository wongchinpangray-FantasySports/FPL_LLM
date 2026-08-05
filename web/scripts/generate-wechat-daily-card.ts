/**
 * Generate a WeChat-friendly daily card (plain text + JSON + optional PNG).
 *
 * Run:
 *   cd web && npx tsx scripts/generate-wechat-daily-card.ts
 *   cd web && npx tsx scripts/generate-wechat-daily-card.ts --png --notify
 *
 * Output: output/wechat-daily/card.txt, card.json, card.png (with --png)
 *
 * Auto-push (optional env):
 *   WECHAT_WORK_WEBHOOK_URL — 企业微信群机器人 webhook
 *   PUSHPLUS_TOKEN — PushPlus 推送到微信（需关注其公众号）
 *
 * Note: personal WeChat 群聊 has no official auto-post API.
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildWechatDailyCard,
  formatWechatDailyCardText,
  notifyWechatDailyCard,
  shanghaiDateIso,
} from "../lib/fpl/wechat-daily-card";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

async function main() {
  const withPng = process.argv.includes("--png");
  const withNotify = process.argv.includes("--notify");
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const cardDate = dateArg ?? shanghaiDateIso();

  const outDir = join(process.cwd(), "output", "wechat-daily");
  mkdirSync(outDir, { recursive: true });

  console.log(`Building WeChat daily card for ${cardDate} (Asia/Shanghai)…`);
  const card = await buildWechatDailyCard({ cardDate, locale: "zh" });
  const text = formatWechatDailyCardText(card);

  const jsonPath = join(outDir, "card.json");
  const txtPath = join(outDir, "card.txt");
  writeFileSync(jsonPath, JSON.stringify(card, null, 2), "utf8");
  writeFileSync(txtPath, text, "utf8");

  console.log(`\nWrote ${txtPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log("\n--- card.txt ---\n");
  console.log(text);

  if (withPng) {
    console.log("\nRendering PNG…");
    execSync("node scripts/render-wechat-daily-card.mjs", {
      cwd: process.cwd(),
      stdio: "inherit",
    });
  }

  if (withNotify) {
    const results = await notifyWechatDailyCard(card, text);
    for (const r of results) {
      console.log(`Notify ${r.channel}: ${r.ok ? "ok" : "failed"}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
