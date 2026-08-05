/**
 * Generate today's FPL daily digest (past 48 hours of X feeds + headlines) via Gemini.
 * Scheduled ~07:00 Asia/Shanghai (23:00 UTC) for morning WeChat card sharing.
 * Requires: SUPABASE_* , GEMINI_API_KEY, migration 0023_fpl_x_digests.sql
 */
import { join } from "node:path";
import {
  londonDigestDateIso,
  syncFplXDigest,
} from "../lib/fpl/fpl-x-digest";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

async function main() {
  const force = process.argv.includes("--force");
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const digestDate = dateArg ?? londonDigestDateIso();

  console.log(`Generating FPL digest for ${digestDate} (past 48 hours)…`);
  const result = await syncFplXDigest({ digestDate, force });
  console.log(
    `Done (${result.source}): ${result.source_items.length} sources, ${result.summary_en.length} chars`,
  );
  console.log("\n--- English ---\n");
  console.log(result.summary_en);
  if (result.summary_zh) {
    console.log("\n--- 中文 ---\n");
    console.log(result.summary_zh);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
