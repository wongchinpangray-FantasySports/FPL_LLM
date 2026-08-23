/**
 * Evening WeChat price-change caution (likely risers / fallers).
 *
 *   cd web && npx tsx scripts/notify-price-caution.ts
 *   cd web && npx tsx scripts/notify-price-caution.ts --dry-run
 *   cd web && npx tsx scripts/notify-price-caution.ts --skip-wechat
 *
 * Env: WECHAT_WORK_WEBHOOK_URL / PUSHPLUS_TOKEN
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

import { buildWechatPriceCaution } from "../lib/fpl/wechat-price-caution";
import { notifyWechatText } from "../lib/fpl/wechat-daily-card";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipWechat = process.argv.includes("--skip-wechat");

  const outDir = join(process.cwd(), "output", "wechat-price-caution");
  mkdirSync(outDir, { recursive: true });

  console.log(`Building price caution${dryRun ? " [dry-run]" : ""}…`);
  const card = await buildWechatPriceCaution();

  writeFileSync(
    join(outDir, "caution.json"),
    JSON.stringify(card, null, 2),
    "utf8",
  );
  writeFileSync(
    join(outDir, "caution.txt"),
    card.text || card.skip_reason || "",
    "utf8",
  );
  console.log(`Wrote ${join(outDir, "caution.txt")}`);

  if (card.skipped) {
    console.log(`Skip: ${card.skip_reason}`);
    return;
  }

  console.log("\n--- WeChat ---\n");
  console.log(card.text);
  console.log("");

  if (skipWechat || dryRun) {
    console.log(
      dryRun ? "WeChat: dry run — no push." : "WeChat: skipped (--skip-wechat).",
    );
    return;
  }

  const results = await notifyWechatText(
    `身价预警 GW${card.gw} ${card.card_date}`,
    card.text,
  );
  for (const r of results) {
    console.log(
      `WeChat ${r.channel}: ${r.ok ? "ok" : "failed"}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
