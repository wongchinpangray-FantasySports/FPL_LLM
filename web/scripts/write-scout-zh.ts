import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import { sanitizeUtf16 } from "../lib/utf16-safe";

const SLUG = "the-scout-squad-our-top-picks-for-fpl-gameweek-1-2";
const TITLE_ZH = "Scout Squad：我们的 FPL 第一轮精选";
const EXCERPT_ZH =
  "Sam、Tom、Marc 和 Neale 回归 2026/27 赛季，各自给出 FPL 第一轮最佳球员选择。";

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const zhPath = join(process.cwd(), "output", "scout-translate", "body_html_zh.html");
  const enPath = join(process.cwd(), "output", "scout-translate", "body_html_en.html");
  const body_html_zh = sanitizeUtf16(readFileSync(zhPath, "utf8").trim());
  const body_html_en = readFileSync(enPath, "utf8");

  const checks = {
    zh_len: body_html_zh.length,
    en_len: body_html_en.length,
    ratio: Number((body_html_zh.length / body_html_en.length).toFixed(3)),
    h2_en: count(body_html_en, /<h2/gi),
    h2_zh: count(body_html_zh, /<h2/gi),
    img_en: count(body_html_en, /<img\b/gi),
    img_zh: count(body_html_zh, /<img\b/gi),
    table_en: count(body_html_en, /<table/gi),
    table_zh: count(body_html_zh, /<table/gi),
    a_en: count(body_html_en, /<a\b/gi),
    a_zh: count(body_html_zh, /<a\b/gi),
    ul_en: count(body_html_en, /<ul/gi),
    ul_zh: count(body_html_zh, /<ul/gi),
    li_en: count(body_html_en, /<li/gi),
    li_zh: count(body_html_zh, /<li/gi),
    p_en: count(body_html_en, /<p/gi),
    p_zh: count(body_html_zh, /<p/gi),
    title_zh_len: TITLE_ZH.length,
    excerpt_zh_len: EXCERPT_ZH.length,
  };
  console.log(JSON.stringify({ dry, checks }, null, 2));
  if (body_html_zh.length < 8000) {
    throw new Error(`Chinese body too short: ${body_html_zh.length}`);
  }
  if (checks.img_zh !== checks.img_en) {
    throw new Error(`img count mismatch en=${checks.img_en} zh=${checks.img_zh}`);
  }
  if (checks.table_zh !== checks.table_en) {
    throw new Error(`table count mismatch`);
  }
  if (checks.h2_zh !== checks.h2_en) {
    throw new Error(`h2 count mismatch en=${checks.h2_en} zh=${checks.h2_zh}`);
  }

  const supa = getServerSupabase();
  const { data: before, error: readErr } = await supa
    .from("scout_articles")
    .select("id,slug,status,translation_error,body_html_en,body_html_zh")
    .eq("slug", SLUG)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!before) throw new Error(`No row for slug=${SLUG}`);
  if (before.status !== "pending") {
    throw new Error(`Refusing to write: status is ${before.status}, expected pending`);
  }

  if (dry) {
    console.log(JSON.stringify({ skipped: "dry-run", id: before.id }, null, 2));
    return;
  }

  const now = new Date().toISOString();
  const { data: after, error: updErr } = await supa
    .from("scout_articles")
    .update({
      title_zh: sanitizeUtf16(TITLE_ZH),
      excerpt_zh: sanitizeUtf16(EXCERPT_ZH),
      body_html_zh,
      translation_error: null,
      translation_model: "cursor-llm",
      translated_at: now,
      translate_requested_at: null,
      updated_at: now,
    })
    .eq("id", before.id)
    .eq("status", "pending")
    .select(
      "id,slug,status,title_zh,excerpt_zh,translation_model,translation_error,translated_at,body_html_en,body_html_zh",
    )
    .maybeSingle();
  if (updErr) throw new Error(updErr.message);
  if (!after) throw new Error("Update returned no row (status may have changed)");

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: after.id,
        slug: after.slug,
        status: after.status,
        translation_model: after.translation_model,
        translation_error: after.translation_error,
        translated_at: after.translated_at,
        lengths: {
          title_zh: String(after.title_zh ?? "").length,
          excerpt_zh: String(after.excerpt_zh ?? "").length,
          body_html_en: String(after.body_html_en ?? "").length,
          body_html_zh: String(after.body_html_zh ?? "").length,
        },
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
