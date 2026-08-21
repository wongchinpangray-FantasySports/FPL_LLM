import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";

async function main() {
  const slugFilter = process.argv.find((a) => a.startsWith("--slug="))?.slice(7) ?? null;
  const supa = getServerSupabase();
  let q = supa
    .from("scout_articles")
    .select(
      "id,slug,status,title_en,title_zh,excerpt_en,excerpt_zh,author,series,translation_model,translation_error,body_html_en,body_html_zh,source_url",
    )
    .order("source_published_at", { ascending: false });
  if (slugFilter) q = q.eq("slug", slugFilter);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const root = join(process.cwd(), "output", "scout-translate");
  mkdirSync(root, { recursive: true });
  const summary: unknown[] = [];

  for (const row of data ?? []) {
    const slug = String(row.slug);
    const dir = join(root, slug);
    mkdirSync(dir, { recursive: true });
    const en = String(row.body_html_en ?? "");
    const zh = String(row.body_html_zh ?? "");
    writeFileSync(join(dir, "body_html_en.html"), en, "utf8");
    writeFileSync(join(dir, "body_html_zh_old.html"), zh, "utf8");
    writeFileSync(
      join(dir, "meta.json"),
      JSON.stringify(
        {
          id: row.id,
          slug,
          status: row.status,
          title_en: row.title_en,
          title_zh: row.title_zh,
          excerpt_en: row.excerpt_en,
          excerpt_zh: row.excerpt_zh,
          author: row.author,
          series: row.series,
          translation_model: row.translation_model,
          translation_error: row.translation_error,
          source_url: row.source_url,
          lengths: { en: en.length, zh: zh.length },
        },
        null,
        2,
      ),
      "utf8",
    );
    summary.push({
      slug,
      status: row.status,
      en: en.length,
      zh: zh.length,
      looks_full_en: en.length >= 6000,
    });
  }

  console.log(JSON.stringify({ dumped: summary.length, summary }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
