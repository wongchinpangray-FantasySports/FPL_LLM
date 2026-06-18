/**
 * Sync FIFA World Cup match scores into Supabase (GitHub Actions / cron).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { syncWcMatchStats } from "../lib/wc/match-stats-store";
import { ensureWcSeeded } from "../lib/wc/seed";

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
  await ensureWcSeeded();
  const result = await syncWcMatchStats();
  console.log(
    `WC match sync: schedule_upserted=${result.schedule_upserted}, fixtures_updated=${result.fixtures_updated}, events_enriched=${result.events_enriched}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
