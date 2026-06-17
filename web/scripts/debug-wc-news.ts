import { WC_NEWS_FEEDS, fetchWcNewsItems } from "../lib/wc/news-feeds";

const FETCH_HEADERS = {
  Accept:
    "application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

async function probeFeed(id: string, url: string) {
  try {
    const headers: Record<string, string> = { ...FETCH_HEADERS };
    if (url.includes("news.google.com")) headers.Referer = "https://news.google.com/";
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    const itemCount = (text.match(/<item[\s>]/gi) ?? []).length;
    const entryCount = (text.match(/<entry[\s>]/gi) ?? []).length;
    return {
      id,
      status: res.status,
      ok: res.ok,
      bytes: text.length,
      items: itemCount + entryCount,
      looksLikeRss: /<rss|<feed/i.test(text),
    };
  } catch (e) {
    return {
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  console.log("Probing feeds (parallel)...");
  const probes = await Promise.all(
    WC_NEWS_FEEDS.map((f) => probeFeed(f.id, f.url)),
  );
  for (const p of probes) console.log(JSON.stringify(p));

  const items = await fetchWcNewsItems({ limit: 150, editorialOnly: false });
  console.log("\nmerged items:", items.length);
  if (items[0]) console.log("newest:", items[0].title, items[0].published_at);
}

void main();
