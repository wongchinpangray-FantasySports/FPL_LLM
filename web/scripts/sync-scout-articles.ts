import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { ingestScoutArticles } from "../lib/scout/ingest";
import { hasFfsSessionCookie } from "../lib/scout/fetch-article";

function flagNum(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) ? n : fallback;
}

function flagStr(name: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return null;
  const v = raw.slice(name.length + 3).trim();
  return v || null;
}

async function main() {
  const pages = flagNum("pages", 1);
  const limit = flagNum("limit", 40);
  const force = process.argv.includes("--force");
  const url = flagStr("url");
  const result = await ingestScoutArticles({
    pages,
    limit: url ? 1 : limit,
    forceTranslate: force,
    urls: url ? [url] : undefined,
  });
  console.log(
    JSON.stringify(
      {
        ...result,
        ffs_session_cookie: hasFfsSessionCookie(),
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
