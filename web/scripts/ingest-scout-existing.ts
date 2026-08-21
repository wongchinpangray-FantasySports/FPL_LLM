import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { ingestScoutArticles } from "../lib/scout/ingest";
import { fetchScoutRssItems } from "../lib/scout/rss";
import { hasFfsSessionCookie, readFfsSessionCookie } from "../lib/scout/fetch-article";
import { getServerSupabase } from "../lib/supabase";

function flagNum(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const cookie = readFfsSessionCookie() ?? "";
  if (!hasFfsSessionCookie()) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "FFS_SESSION_COOKIE / FFS_AUTH_COOKIE missing — refusing anonymous ingest",
      }),
    );
    process.exit(1);
  }
  if (!/wordpress_logged_in/i.test(cookie)) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "Cookie present but wordpress_logged_in missing — refusing ingest",
        cookie_length: cookie.length,
      }),
    );
    process.exit(1);
  }

  const pages = flagNum("pages", 2);
  const force = process.argv.includes("--force");
  const translate = process.argv.includes("--translate");

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select("slug,source_url");
  if (error) throw new Error(error.message);

  const dbUrls = (data ?? [])
    .map((r) => String(r.source_url ?? "").trim())
    .filter((u) => u.startsWith("http"));

  const rss = await fetchScoutRssItems(pages);
  const rssUrls = rss.map((i) => i.url);
  const urls = [...new Set([...dbUrls, ...rssUrls])];

  console.log(
    JSON.stringify(
      {
        cookie_length: cookie.length,
        has_wordpress_logged_in: true,
        db_rows: dbUrls.length,
        rss_items: rssUrls.length,
        union_urls: urls.length,
        pages,
        force,
        translate,
        skip_gemini: !translate,
      },
      null,
      2,
    ),
  );

  const result = await ingestScoutArticles({
    pages,
    limit: urls.length,
    translate,
    force,
    urls,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.created + result.updated + result.skipped === 0) process.exit(1);
  if (result.failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
