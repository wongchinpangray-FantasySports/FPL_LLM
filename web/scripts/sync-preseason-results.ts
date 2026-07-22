/**
 * Sync pre-season friendly scores into epl-preseason-2627.json (GitHub Actions / manual).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { syncPreseasonResultsJson } from "../lib/fpl/preseason-sync";

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
  if (!process.env.API_FOOTBALL_KEY?.trim()) {
    throw new Error("API_FOOTBALL_KEY is required");
  }

  const result = await syncPreseasonResultsJson();
  console.log(
    [
      "Pre-season sync complete.",
      `path=${result.path}`,
      `total=${result.total}`,
      `updated=${result.updated}`,
      `newly_finished=${result.newly_finished}`,
      `wrote_file=${result.wrote_file}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
