import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { ingestScoutArticles } from "../lib/scout/ingest";

function flagNum(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const pages = flagNum("pages", 1);
  const limit = flagNum("limit", 40);
  const force = process.argv.includes("--force");
  const result = await ingestScoutArticles({
    pages,
    limit,
    forceTranslate: force,
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        note: "New rows stay pending. Publish from /admin (Scout articles tab).",
      },
      null,
      2,
    ),
  );
  if (result.created + result.updated + result.skipped === 0) {
    process.exit(1);
  }
  if (result.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
