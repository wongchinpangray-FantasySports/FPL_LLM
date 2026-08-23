/**
 * Matchday WeChat notes — fixtures in the next N hours, injuries, EP watches.
 *
 *   cd web && npx tsx scripts/notify-matchday.ts
 *   cd web && npx tsx scripts/notify-matchday.ts --dry-run
 *   cd web && npx tsx scripts/notify-matchday.ts --skip-wechat
 *   cd web && npx tsx scripts/notify-matchday.ts --hours 18
 *
 * Env: WECHAT_WORK_WEBHOOK_URL / PUSHPLUS_TOKEN
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

import { buildWechatMatchday } from "../lib/fpl/wechat-matchday";
import { notifyWechatText } from "../lib/fpl/wechat-daily-card";

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipWechat = process.argv.includes("--skip-wechat");
  const hoursRaw = argValue("--hours");
  const horizonHours = hoursRaw ? Number(hoursRaw) : undefined;

  const outDir = join(process.cwd(), "output", "wechat-matchday");
  mkdirSync(outDir, { recursive: true });

  console.log(
    `Building matchday notes${horizonHours ? ` (window ${horizonHours}h)` : ""}${dryRun ? " [dry-run]" : ""}…`,
  );
  const card = await buildWechatMatchday({ horizonHours });

  writeFileSync(join(outDir, "matchday.json"), JSON.stringify(card, null, 2), "utf8");
  writeFileSync(join(outDir, "matchday.txt"), card.text || card.skip_reason || "", "utf8");
  console.log(`Wrote ${join(outDir, "matchday.txt")}`);

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
    `比赛日 GW${card.gw} ${card.card_date}`,
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
