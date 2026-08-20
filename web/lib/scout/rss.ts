import { FFS_RSS_URL } from "@/lib/scout/links";
import { decodeXmlEntities, stripTags } from "@/lib/scout/html";
import type { ScoutRssItem } from "@/lib/scout/types";

const FETCH_HEADERS = {
  Accept: "application/rss+xml, application/xml, text/xml, */*",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function extractTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1] ? decodeXmlEntities(m[1].trim()) : "";
}

function extractLink(block: string): string {
  const plain = extractTag(block, "link").trim();
  if (plain.startsWith("http")) return plain;
  const m = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
}

function extractCategories(block: string): string[] {
  const out: string[] = [];
  const re = /<category(?:\s[^>]*)?>([\s\S]*?)<\/category>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const label = stripTags(decodeXmlEntities(m[1] ?? "")).trim();
    if (label) out.push(label);
  }
  return out;
}

export function parseScoutRss(xml: string): ScoutRssItem[] {
  const items: ScoutRssItem[] = [];
  for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
    const title = stripTags(extractTag(block, "title"));
    const url = extractLink(block);
    if (!title || !url.startsWith("http")) continue;
    const guid =
      stripTags(extractTag(block, "guid")) ||
      url.replace(/\/+$/, "").split("?")[0]!;
    const excerpt = stripTags(
      extractTag(block, "content:encoded") ||
        extractTag(block, "description"),
    ).slice(0, 400);
    const author =
      stripTags(extractTag(block, "dc:creator") || extractTag(block, "author")) ||
      null;
    const pubRaw = extractTag(block, "pubDate");
    let published_at: string | null = null;
    if (pubRaw) {
      const ts = Date.parse(pubRaw);
      published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
    }
    items.push({
      title,
      url,
      guid,
      excerpt,
      author,
      published_at,
      categories: extractCategories(block),
    });
  }
  return items;
}

export async function fetchScoutRssPage(page = 1): Promise<ScoutRssItem[]> {
  const url =
    page <= 1 ? FFS_RSS_URL : `${FFS_RSS_URL}?paged=${page}`;
  const res = await fetch(url, {
    headers: FETCH_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  if (!/<rss|<feed/i.test(xml)) return [];
  return parseScoutRss(xml);
}

export async function fetchScoutRssItems(pages = 1): Promise<ScoutRssItem[]> {
  const n = Math.min(8, Math.max(1, pages));
  const seen = new Set<string>();
  const out: ScoutRssItem[] = [];
  for (let page = 1; page <= n; page++) {
    const batch = await fetchScoutRssPage(page);
    if (batch.length === 0) break;
    for (const item of batch) {
      if (seen.has(item.guid) || seen.has(item.url)) continue;
      seen.add(item.guid);
      seen.add(item.url);
      out.push(item);
    }
  }
  return out;
}
