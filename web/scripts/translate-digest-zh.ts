import { ensureDigestChineseSummary } from "../lib/fpl/fpl-x-digest";
import { shanghaiDateIso } from "../lib/fpl/wechat-daily-card";
import { loadScriptEnv } from "./load-env";

loadScriptEnv();

async function main() {
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const digestDate = dateArg ?? shanghaiDateIso();
  console.log(`Translating digest ${digestDate} to Chinese…`);
  const record = await ensureDigestChineseSummary(digestDate);
  if (!record?.summary_zh) {
    console.error(
      "Translation failed — set GEMINI_API_KEY in web/.env.local or repo-root .env",
    );
    process.exit(1);
  }
  console.log("\n--- 中文 ---\n");
  console.log(record.summary_zh);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
