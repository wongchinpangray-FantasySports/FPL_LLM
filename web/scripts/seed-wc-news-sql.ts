/**
 * Fetch football news RSS locally and write a Supabase SQL seed file.
 * Run from web/: npx tsx scripts/seed-wc-news-sql.ts
 * Then run supabase/seed_wc_news_cache.sql in the Supabase SQL editor.
 * Output is gitignored — regenerate whenever you need a fresh cache seed.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchWcNewsItems } from "../lib/wc/news-feeds";

async function main() {
  const items = await fetchWcNewsItems({ limit: 150, editorialOnly: false });
  const fetchedAt = new Date().toISOString();
  const json = JSON.stringify(items).replace(/'/g, "''");

  const sql = `-- One-time seed for wc_news_cache (${items.length} items)
-- Run after migration 0018_wc_news_cache.sql

insert into public.wc_news_cache (id, items, fetched_at)
values (
  'global',
  '${json}'::jsonb,
  '${fetchedAt}'::timestamptz
)
on conflict (id) do update
set items = excluded.items,
    fetched_at = excluded.fetched_at;
`;

  const outPath = join(process.cwd(), "..", "supabase", "seed_wc_news_cache.sql");
  writeFileSync(outPath, sql, "utf8");
  console.log(`Wrote ${items.length} items to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
