import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";

const SLUG = "the-scout-squad-our-top-picks-for-fpl-gameweek-1-2";

function envMeta() {
  const keys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "FFS_SESSION_COOKIE",
    "FFS_COOKIE",
  ];
  return keys.map((k) => {
    const v = process.env[k];
    return { key: k, present: Boolean(v?.trim()), length: v?.trim()?.length ?? 0 };
  });
}

async function main() {
  console.log(JSON.stringify({ env: envMeta() }, null, 2));

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select(
      "id,slug,source_guid,source_url,status,title_en,title_zh,excerpt_en,excerpt_zh,author,series,translation_model,translation_error,translated_at,content_hash,body_html_en,body_html_zh,hero_image_url",
    )
    .eq("slug", SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No scout_articles row for slug=${SLUG}`);

  const en = String(data.body_html_en ?? "");
  const zh = String(data.body_html_zh ?? "");
  const outDir = join(process.cwd(), "output", "scout-translate");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "body_html_en.html"), en, "utf8");
  writeFileSync(join(outDir, "body_html_zh_old.html"), zh, "utf8");
  writeFileSync(
    join(outDir, "meta.json"),
    JSON.stringify(
      {
        id: data.id,
        slug: data.slug,
        source_guid: data.source_guid,
        source_url: data.source_url,
        status: data.status,
        title_en: data.title_en,
        title_zh: data.title_zh,
        excerpt_en: data.excerpt_en,
        excerpt_zh: data.excerpt_zh,
        author: data.author,
        series: data.series,
        translation_model: data.translation_model,
        translation_error: data.translation_error,
        translated_at: data.translated_at,
        content_hash: data.content_hash,
        hero_image_url: data.hero_image_url,
        lengths: {
          title_en: String(data.title_en ?? "").length,
          title_zh: String(data.title_zh ?? "").length,
          excerpt_en: String(data.excerpt_en ?? "").length,
          excerpt_zh: String(data.excerpt_zh ?? "").length,
          body_html_en: en.length,
          body_html_zh: zh.length,
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        id: data.id,
        slug: data.slug,
        status: data.status,
        translation_error: data.translation_error,
        translation_model: data.translation_model,
        lengths: {
          title_en: String(data.title_en ?? "").length,
          title_zh: String(data.title_zh ?? "").length,
          excerpt_en: String(data.excerpt_en ?? "").length,
          excerpt_zh: String(data.excerpt_zh ?? "").length,
          body_html_en: en.length,
          body_html_zh: zh.length,
        },
        outDir,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
