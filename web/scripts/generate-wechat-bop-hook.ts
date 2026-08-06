/**
 * Generate WeChat BOP hook files only (no in-app / WeChat push).
 *
 *   cd web && npx tsx scripts/generate-wechat-bop-hook.ts
 *   cd web && npx tsx scripts/generate-wechat-bop-hook.ts --band mid-5-0
 *
 * One-shot in-app + WeChat: npm run notify:bop
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildWechatBopHook } from "../lib/fpl/wechat-bop-hook";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const bandId = argValue("--band");
  const outDir = join(process.cwd(), "output", "wechat-bop");
  mkdirSync(outDir, { recursive: true });

  console.log(
    `Building WeChat BOP hook${bandId ? ` for ${bandId}` : " (daily rotate)"}…`,
  );
  const hook = await buildWechatBopHook({
    bandId: bandId || undefined,
    locale: "zh",
  });

  writeFileSync(join(outDir, "hook.json"), JSON.stringify(hook, null, 2), "utf8");
  writeFileSync(join(outDir, "hook.txt"), hook.text_full, "utf8");
  writeFileSync(join(outDir, "hook-short.txt"), hook.text_short, "utf8");

  console.log(`\nWrote ${join(outDir, "hook.txt")}`);
  console.log(`Wrote ${join(outDir, "hook-short.txt")}`);
  console.log("\n========== 完整版 ==========\n");
  console.log(hook.text_full);
  console.log("\n========== 短钩子 ==========\n");
  console.log(hook.text_short);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
