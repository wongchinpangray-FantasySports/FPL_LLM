/**
 * Render public sample diagnosis PDFs for /pro download buttons.
 * Gold master is now Entry 916934 GW5 (A ¥19 + B ¥49).
 *   node scripts/render-sample-report-pdfs.mjs
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = join(__dirname, "render-delivery-916934-gw5.mjs");
const result = spawnSync(process.execPath, [script], {
  cwd: join(__dirname, ".."),
  stdio: "inherit",
});
process.exit(result.status ?? 1);
