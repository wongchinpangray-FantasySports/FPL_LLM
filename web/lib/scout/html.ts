import { createHash } from "node:crypto";
import type { ScoutImage, ScoutSeries } from "@/lib/scout/types";

const ALLOWED_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "a",
  "img",
  "figure",
  "figcaption",
  "blockquote",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
  "div",
  "sup",
  "sub",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

export function decodeXmlEntities(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

export function stripTags(html: string): string {
  return decodeXmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractBalancedInner(
  html: string,
  openTagEnd: number,
  tag: string,
): string | null {
  const open = new RegExp(`<${tag}\\b`, "gi");
  const close = new RegExp(`</${tag}\\s*>`, "gi");
  let depth = 1;
  let i = openTagEnd;
  while (i < html.length && depth > 0) {
    open.lastIndex = i;
    close.lastIndex = i;
    const nextOpen = open.exec(html);
    const nextClose = close.exec(html);
    if (!nextClose) return null;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth += 1;
      i = nextOpen.index + nextOpen[0].length;
    } else {
      depth -= 1;
      if (depth === 0) {
        return html.slice(openTagEnd, nextClose.index);
      }
      i = nextClose.index + nextClose[0].length;
    }
  }
  return null;
}

export function extractHtmlByClass(
  html: string,
  className: string,
): string | null {
  const re = new RegExp(
    `<(div|section|article)[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>`,
    "i",
  );
  const m = re.exec(html);
  if (!m) return null;
  const tag = (m[1] ?? "div").toLowerCase();
  return extractBalancedInner(html, m.index + m[0].length, tag);
}

export function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    const url = m?.[1]?.trim();
    if (url?.startsWith("http")) return url.split("?")[0] ?? url;
  }
  return null;
}

export function extractMetaContent(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)`,
    "i",
  );
  const m = html.match(re);
  return m?.[1]?.trim() || null;
}

function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i");
  const m = tag.match(re);
  return m?.[2]?.trim() ?? null;
}

function isSafeHttpUrl(raw: string | null | undefined): raw is string {
  if (!raw?.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function absolutizeUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return src;
  }
}

/** Conservative HTML allow-list. Images keep original https src. */
export function sanitizeScoutHtml(
  html: string,
  opts?: { baseUrl?: string },
): { html: string; images: ScoutImage[] } {
  const baseUrl = opts?.baseUrl ?? "https://www.fantasyfootballscout.co.uk/";
  const images: ScoutImage[] = [];
  const seen = new Set<string>();

  let raw = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  raw = raw.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED_TAGS.has(name)) return "";
    if (closing) return VOID_TAGS.has(name) ? "" : `</${name}>`;

    if (name === "br" || name === "hr") return `<${name}>`;

    if (name === "img") {
      const srcRaw = attr(full, "src") ?? attr(full, "data-src");
      if (!srcRaw) return "";
      const abs = absolutizeUrl(srcRaw, baseUrl);
      if (!isSafeHttpUrl(abs)) return "";
      const alt = (attr(full, "alt") ?? "").replace(/"/g, "&quot;");
      if (!seen.has(abs)) {
        seen.add(abs);
        images.push({ src: abs, alt });
      }
      return `<img src="${abs}" alt="${alt}" loading="lazy">`;
    }

    if (name === "a") {
      const href = attr(full, "href");
      if (!href || href.startsWith("javascript:") || href.startsWith("data:")) {
        return "<span>";
      }
      if (href.startsWith("#")) return `<a href="${href}">`;
      const abs = absolutizeUrl(href, baseUrl);
      if (!isSafeHttpUrl(abs)) return "<span>";
      return `<a href="${abs}" target="_blank" rel="noopener noreferrer">`;
    }

    return `<${name}>`;
  });

  raw = raw.replace(/\s+(on\w+|style|class|id)\s*=\s*(["']).*?\2/gi, "");
  raw = raw.replace(/\n{3,}/g, "\n\n").trim();

  return { html: raw, images };
}

export function rewriteHtmlImagesToProxy(html: string): string {
  return html.replace(
    /<img([^>]*?)\ssrc=["']([^"']+)["']([^>]*)>/gi,
    (_m, pre: string, src: string, post: string) => {
      if (src.startsWith("/api/news/image")) {
        return `<img${pre} src="${src}"${post}>`;
      }
      const proxied = `/api/news/image?url=${encodeURIComponent(src)}`;
      return `<img${pre} src="${proxied}"${post}>`;
    },
  );
}

export function excerptFromHtml(html: string, max = 220): string {
  const text = stripTags(html);
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

export function hashContent(parts: string[]): string {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 40);
}

export function slugFromSourceUrl(url: string, guid: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const last = path.split("/").filter(Boolean).pop() ?? "";
    const slug = last
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (slug.length >= 8) return slug.slice(0, 120);
  } catch {
    /* fall through */
  }
  const id = guid.replace(/\D+/g, "").slice(-8) || hashContent([url]).slice(0, 8);
  return `scout-${id}`;
}

export function seriesFromCategories(categories: string[]): ScoutSeries {
  const blob = categories.join(" | ").toLowerCase();
  if (/team guides?|team previews?/.test(blob)) return "team_guide";
  if (/scout reports?/.test(blob)) return "scout_report";
  if (/scout notes?/.test(blob)) return "scout_notes";
  if (/\bpreviews?\b/.test(blob) && !/team previews?/.test(blob)) return "preview";
  if (/\breviews?\b/.test(blob)) return "review";
  if (/team news/.test(blob)) return "team_news";
  if (/scout squad/.test(blob)) return "scout_squad";
  return "other";
}

export function collectImageUrls(html: string, hero?: string | null): ScoutImage[] {
  const out: ScoutImage[] = [];
  const seen = new Set<string>();
  if (hero && isSafeHttpUrl(hero) && !seen.has(hero)) {
    seen.add(hero);
    out.push({ src: hero, alt: "" });
  }
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const src = m[1];
    if (!isSafeHttpUrl(src) || seen.has(src)) continue;
    seen.add(src);
    out.push({ src, alt: m[2] ?? "" });
  }
  return out;
}
