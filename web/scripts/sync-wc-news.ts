/**
 * Sync World Cup news RSS into Supabase. Intended for GitHub Actions / local cron
 * because Cloudflare Workers often cannot reach Google News RSS feeds.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { syncWcNews } from "../lib/wc/news-store";

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
  const result = await syncWcNews();
  console.log(`Synced ${result.count} news items at ${result.fetched_at}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
