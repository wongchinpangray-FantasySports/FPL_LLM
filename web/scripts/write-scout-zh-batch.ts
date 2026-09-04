/**
 * Cursor Scout ZH queue.
 *
 * Dump requested (or given) English rows:
 *   npx tsx scripts/write-scout-zh-batch.ts --requested
 *   npx tsx scripts/write-scout-zh-batch.ts --slugs=a,b
 *
 * After writing output/scout-translate/<slug>/body_html_zh.html + meta.zh.json
 * { title_zh, excerpt_zh, summary_zh } (summary_zh ≈ 200 words for XHS carousel):
 *   npx tsx scripts/write-scout-zh-batch.ts --apply --slugs=a,b
 *
 * `--apply` also renders the XHS teaser feed for those slugs unless `--no-xhs`.
 * Default carousel theme is `--theme=xhs` (coral/pink/purple on white); pass
 * `--theme=faleague` for the dark Faleague palette.
 * Same-day extra runs write `feed-YYYYMMDD-xhs` or `feed-YYYYMMDD-2` (then -3, …).
 * Does not publish. Does not call Gemini/OpenAI/DeepSeek.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import { getServerSupabase } from "../lib/supabase";
import { listScoutTranslateQueue } from "../lib/scout/store";
import { sanitizeUtf16 } from "../lib/utf16-safe";
import type { ScoutArticle } from "../lib/scout/types";

function count(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

function flagStr(name: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return null;
  const v = raw.slice(name.length + 3).trim();
  return v || null;
}

function parseSlugs(): string[] {
  const raw = flagStr("slugs") || flagStr("slug");
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function queueRoot(): string {
  return join(process.cwd(), "output", "scout-translate");
}

function dumpArticle(article: ScoutArticle): {
  slug: string;
  dir: string;
  en_len: number;
} {
  const dir = join(queueRoot(), article.slug);
  mkdirSync(dir, { recursive: true });
  const en = article.body_html_en ?? "";
  writeFileSync(join(dir, "body_html_en.html"), en, "utf8");
  writeFileSync(
    join(dir, "meta.json"),
    JSON.stringify(
      {
        id: article.id,
        slug: article.slug,
        status: article.status,
        title_en: article.title_en,
        excerpt_en: article.excerpt_en,
        author: article.author,
        series: article.series,
        source_url: article.source_url,
        translate_requested_at: article.translate_requested_at,
        translation_error: article.translation_error,
        lengths: {
          title_en: article.title_en.length,
          excerpt_en: (article.excerpt_en ?? "").length,
          body_html_en: en.length,
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  return { slug: article.slug, dir, en_len: en.length };
}

async function dumpQueue(articles: ScoutArticle[]): Promise<void> {
  const root = queueRoot();
  mkdirSync(root, { recursive: true });
  const dumped = articles.map(dumpArticle);
  const queuePath = join(process.cwd(), "output", "scout-translate-queue.json");
  writeFileSync(
    join(process.cwd(), "output", "scout-translate-queue.json"),
    JSON.stringify(
      {
        note:
          "Translate each article to Simplified Chinese. Keep HTML tags, player names in English, FPL jargon. Write output/scout-translate/<slug>/body_html_zh.html and meta.zh.json { title_zh, excerpt_zh, summary_zh }. summary_zh is a ~200-word / 30s–1min Simplified Chinese carousel summary (2 short paragraphs, player names English, no URLs, no invented facts) for XHS teaser pages — not a clipped excerpt of the body. Then: npx tsx scripts/write-scout-zh-batch.ts --apply --slugs=<slugs>. Do not publish. Do not call Gemini/OpenAI/DeepSeek.",
        count: dumped.length,
        slugs: dumped.map((d) => d.slug),
        articles: articles.map((a) => ({
          slug: a.slug,
          status: a.status,
          title_en: a.title_en,
          excerpt_en: a.excerpt_en,
          body_html_en: a.body_html_en,
          source_url: a.source_url,
          translate_requested_at: a.translate_requested_at,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(
    JSON.stringify(
      {
        mode: "dump",
        count: dumped.length,
        slugs: dumped.map((d) => d.slug),
        queue: queuePath,
        dirs: dumped.map((d) => ({ slug: d.slug, en_len: d.en_len })),
        next: dumped.length
          ? `After writing ZH files: npx tsx scripts/write-scout-zh-batch.ts --apply --slugs=${dumped.map((d) => d.slug).join(",")}`
          : "No requested rows. Ray must check articles in /admin → Scout 文章 → 请求 Cursor 翻译.",
      },
      null,
      2,
    ),
  );
}

async function applyFromFiles(slugFilter: string[]): Promise<string[]> {
  const dry = process.argv.includes("--dry");
  const root = queueRoot();
  const slugs = slugFilter.length
    ? slugFilter
    : existsSync(root)
      ? readdirSync(root, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];

  const supa = getServerSupabase();
  const results: unknown[] = [];

  for (const slug of slugs) {
    const dir = join(root, slug);
    const zhPath = join(dir, "body_html_zh.html");
    const metaPath = join(dir, "meta.zh.json");
    if (!existsSync(zhPath) || !existsSync(metaPath)) {
      results.push({ slug, skipped: "missing zh files" });
      continue;
    }
    const body_html_zh = sanitizeUtf16(readFileSync(zhPath, "utf8").trim());
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      title_zh: string;
      excerpt_zh: string;
    };
    const enPath = join(dir, "body_html_en.html");
    const body_html_en = existsSync(enPath)
      ? readFileSync(enPath, "utf8")
      : "";

    const { data: before, error: readErr } = await supa
      .from("scout_articles")
      .select("id,slug,status")
      .eq("slug", slug)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!before) {
      results.push({ slug, error: "row missing" });
      continue;
    }

    const checks = {
      zh_len: body_html_zh.length,
      en_len: body_html_en.length,
      h2_en: count(body_html_en, /<h2/gi),
      h2_zh: count(body_html_zh, /<h2/gi),
      img_en: count(body_html_en, /<img\b/gi),
      img_zh: count(body_html_zh, /<img\b/gi),
      table_en: count(body_html_en, /<table/gi),
      table_zh: count(body_html_zh, /<table/gi),
    };

    if (dry) {
      results.push({ slug, dry: true, status: before.status, checks });
      continue;
    }

    const now = new Date().toISOString();
    const { data: after, error: updErr } = await supa
      .from("scout_articles")
      .update({
        title_zh: sanitizeUtf16(meta.title_zh),
        excerpt_zh: sanitizeUtf16(meta.excerpt_zh),
        body_html_zh,
        translation_error: null,
        translation_model: "cursor-llm",
        translated_at: now,
        translate_requested_at: null,
        updated_at: now,
      })
      .eq("id", before.id)
      .select(
        "id,slug,status,title_zh,translation_model,translation_error,translate_requested_at,body_html_en,body_html_zh",
      )
      .maybeSingle();
    if (updErr) throw new Error(updErr.message);
    if (!after) {
      results.push({ slug, error: "update returned no row" });
      continue;
    }
    results.push({
      ok: true,
      slug: after.slug,
      status: after.status,
      translation_model: after.translation_model,
      translation_error: after.translation_error,
      translate_requested_at: after.translate_requested_at,
      title_zh: after.title_zh,
      lengths: {
        en: String(after.body_html_en ?? "").length,
        zh: String(after.body_html_zh ?? "").length,
      },
      checks,
    });
  }

  console.log(JSON.stringify({ mode: "apply", dry, results }, null, 2));
  return results
    .map((row) =>
      row && typeof row === "object" && "ok" in row && "slug" in row
        ? String((row as { slug: string }).slug)
        : "",
    )
    .filter(Boolean);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const requested = process.argv.includes("--requested");
  const slugs = parseSlugs();

  if (apply) {
    const written = await applyFromFiles(slugs);
    const skipXhs = process.argv.includes("--no-xhs");
    if (!skipXhs && written.length && !process.argv.includes("--dry")) {
      const xhsArgs = ["tsx", "scripts/scout-xhs-pages.ts", `--slugs=${written.join(",")}`];
      if (!process.argv.includes("--theme=faleague")) {
        xhsArgs.push("--theme=xhs");
      }
      // Multiple covers: chunk the batch; each close page lists titles not on that cover.
      if (written.length > 4) {
        xhsArgs.push("--all");
      }
      const xhs = spawnSync("npx", xhsArgs, {
        cwd: process.cwd(),
        stdio: "inherit",
        shell: true,
      });
      if (xhs.status) process.exit(xhs.status);
    }
    return;
  }

  if (requested || slugs.length) {
    const articles = await listScoutTranslateQueue({
      slugs: slugs.length ? slugs : undefined,
    });
    await dumpQueue(articles);
    return;
  }

  // Legacy: apply every slug folder that already has ZH files.
  await applyFromFiles([]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
