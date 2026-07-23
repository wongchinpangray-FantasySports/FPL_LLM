/**
 * Sync pre-season friendly scores and scorers into epl-preseason-2627.json.
 * Uses PL official article + RSS; API-Football (when API_FOOTBALL_KEY is set) fills
 * behind-closed-doors results and goal details.
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
  const result = await syncPreseasonResultsJson();
  console.log(
    [
      "Pre-season sync complete.",
      `path=${result.path}`,
      `total=${result.total}`,
      `external_results=${result.external_results}`,
      `updated=${result.updated}`,
      `newly_finished=${result.newly_finished}`,
      `goals_updated=${result.goals_updated}`,
      `wrote_file=${result.wrote_file}`,
    ].join(" "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
