import {
  extractHtmlByClass,
  extractOgImage,
  sanitizeScoutHtml,
} from "@/lib/scout/html";

const FETCH_HEADERS = {
  Accept: "text/html,application/xhtml+xml",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: "https://www.fantasyfootballscout.co.uk/",
};

export type ScoutFetchedArticle = {
  body_html: string;
  hero_image_url: string | null;
  truncated: boolean;
};

export async function fetchScoutArticleHtml(
  url: string,
): Promise<ScoutFetchedArticle | null> {
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(18_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const raw =
      extractHtmlByClass(html, "entry-content") ??
      extractHtmlByClass(html, "post-content") ??
      extractHtmlByClass(html, "article-content");
    if (!raw || stripLen(raw) < 80) return null;

    const truncated = /requires a Fantasy Football Scout user account/i.test(
      raw,
    );
    const cleaned = truncated
      ? raw.replace(
          /[\s\S]{0,80}requires a Fantasy Football Scout user account[\s\S]{0,400}/i,
          "",
        )
      : raw;

    const { html: body_html } = sanitizeScoutHtml(cleaned, { baseUrl: url });
    if (stripLen(body_html) < 80) return null;

    return {
      body_html,
      hero_image_url: extractOgImage(html),
      truncated,
    };
  } catch {
    return null;
  }
}

function stripLen(html: string): number {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
}
