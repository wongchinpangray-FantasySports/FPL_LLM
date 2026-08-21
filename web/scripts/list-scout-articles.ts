import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import { hasFfsSessionCookie, readFfsSessionCookie } from "../lib/scout/fetch-article";

function envMeta() {
  const keys = [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "FFS_SESSION_COOKIE",
    "FFS_AUTH_COOKIE",
  ];
  return keys.map((k) => {
    const v = process.env[k];
    return { key: k, present: Boolean(v?.trim()), length: v?.trim()?.length ?? 0 };
  });
}

function cookieFlags() {
  const cookie = readFfsSessionCookie() ?? "";
  return {
    has_cookie: hasFfsSessionCookie(),
    cookie_length: cookie.length,
    has_wordpress_logged_in: /wordpress_logged_in/i.test(cookie),
    has_ffs_token: /\bffs_token=/.test(cookie),
  };
}

async function main() {
  console.log(
    JSON.stringify(
      { env: envMeta(), cookie: cookieFlags() },
      null,
      2,
    ),
  );

  const supa = getServerSupabase();
  const { data, error } = await supa
    .from("scout_articles")
    .select(
      "id,slug,source_url,source_guid,status,title_en,title_zh,translation_model,translation_error,body_html_en,body_html_zh,source_published_at,updated_at",
    )
    .order("source_published_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row) => {
    const en = String(row.body_html_en ?? "");
    const zh = String(row.body_html_zh ?? "");
    return {
      id: row.id,
      slug: row.slug,
      source_url: row.source_url,
      status: row.status,
      title_en: row.title_en,
      title_zh: row.title_zh,
      translation_model: row.translation_model,
      translation_error: row.translation_error,
      body_html_en_len: en.length,
      body_html_zh_len: zh.length,
      looks_full_en: en.length >= 6000,
      source_published_at: row.source_published_at,
    };
  });

  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
