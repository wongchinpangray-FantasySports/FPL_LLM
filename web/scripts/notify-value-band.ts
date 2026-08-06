/**
 * Legacy alias → Best of Position one-shot (MID £5.0m).
 * Prefer: npm run notify:bop -- --band mid-5-0
 */
import { spawnSync } from "node:child_process";

const extra = process.argv.slice(2).filter((a) => a !== "--band");
const result = spawnSync(
  "npx",
  ["tsx", "scripts/notify-bop-hook.ts", "--band", "mid-5-0", ...extra],
  { cwd: process.cwd(), stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
