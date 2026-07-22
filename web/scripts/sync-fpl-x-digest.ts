/**
 * Generate today's FPL morning digest (Europe/London 00:00–12:00) via Gemini.
 * Requires: SUPABASE_* , GEMINI_API_KEY, migration 0023_fpl_x_digests.sql
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  londonDigestDateIso,
  syncFplXDigest,
} from "../lib/fpl/fpl-x-digest";

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvLocal();

async function main() {
  const force = process.argv.includes("--force");
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const digestDate = dateArg ?? londonDigestDateIso();

  console.log(`Generating FPL digest for ${digestDate} (London morning window)…`);
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
