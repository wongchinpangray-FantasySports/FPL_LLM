import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

function looksFullEn(en: string): boolean {
  if (/requires a Fantasy Football Scout user account/i.test(en)) return false;
  if (en.length < 3500) return false;
  return true;
}

async function main() {
  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select(
      "id,slug,status,title_en,title_zh,excerpt_en,excerpt_zh,source_url,translation_model,translation_error,body_html_en,body_html_zh,source_published_at",
    )
    .order("source_published_at", { ascending: false });
  if (error) throw new Error(error.message);

  const root = join(process.cwd(), "output", "scout-translate");
  mkdirSync(root, { recursive: true });

  const summary = (data ?? []).map((row) => {
    const en = String(row.body_html_en ?? "");
    const zh = String(row.body_html_zh ?? "");
    const dir = join(root, String(row.slug));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "body_html_en.html"), en, "utf8");
    writeFileSync(join(dir, "body_html_zh_old.html"), zh, "utf8");
    const meta = {
      id: row.id,
      slug: row.slug,
      status: row.status,
      title_en: row.title_en,
      title_zh: row.title_zh,
      excerpt_en: row.excerpt_en,
      excerpt_zh: row.excerpt_zh,
      source_url: row.source_url,
      translation_model: row.translation_model,
      translation_error: row.translation_error,
      lengths: { en: en.length, zh: zh.length },
      tags: {
        h2_en: count(en, /<h2/gi),
        img_en: count(en, /<img\b/gi),
        table_en: count(en, /<table/gi),
        a_en: count(en, /<a\b/gi),
        p_en: count(en, /<p/gi),
        li_en: count(en, /<li/gi),
      },
    };
    writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
    return {
      slug: row.slug,
      status: row.status,
      title_en: row.title_en,
      en: en.length,
      zh: zh.length,
      looks_full_en: looksFullEn(en),
      paywall: /requires a Fantasy Football Scout user account/i.test(en),
      zh_is_en_copy: zh.length > 0 && zh === en,
      h2: meta.tags.h2_en,
      img: meta.tags.img_en,
      table: meta.tags.table_en,
    };
  });

  writeFileSync(join(root, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
