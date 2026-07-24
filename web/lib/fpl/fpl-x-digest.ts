import { createHash } from "node:crypto";
import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";
import { getServerSupabase } from "@/lib/supabase";
import { loadWcNewsFromDb } from "@/lib/wc/news-store";
import type { WcNewsItem } from "@/lib/wc/news-feeds";

export const FPL_DIGEST_TZ = "Europe/London";
export const FPL_DIGEST_WINDOW_HOURS = 48;
/** Max length for AI-generated digest body (English word count). */
export const FPL_DIGEST_SUMMARY_MAX_WORDS = 500;
/** Comparable length for Chinese digest (~1.8 chars per English word). */
export const FPL_DIGEST_SUMMARY_MAX_CHARS_ZH = Math.round(
  FPL_DIGEST_SUMMARY_MAX_WORDS * 1.8,
);

export type FplXDigestSource = {
  outlet: string;
  text: string;
  url: string;
  published_at: string | null;
  kind: "tweet" | "headline";
};

export type FplXDigestRecord = {
  digest_date: string;
  window_start: string;
  window_end: string;
  summary_en: string;
  summary_zh: string | null;
  source_items: FplXDigestSource[];
  source_fingerprint: string;
  model: string | null;
  generated_at: string;
  source: "cache" | "gemini" | "template";
};

const FFSCOUT_RSS = "https://www.fantasyfootballscout.co.uk/feed/";
const BBC_PL_RSS = "https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml";
const GUARDIAN_FOOTBALL_RSS = "https://www.theguardian.com/football/rss";
const FPL_HEADLINE_RE =
  /\bFPL\b|fantasy premier league|gameweek|\bGW\s?\d|price change|wildcard|deadline|mini-league|expected points|\bxP\b/i;
const PL_NEWS_RE =
  /injur|doubtful|ruled out|line-?up|starting XI|team news|transfer|sign(?:ing|ed|s)?|loan|premier league|\bEPL\b|press conference|matchday squad|fitness|sidelined|here we go|agreed deal/i;

export function londonDigestDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FPL_DIGEST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Rolling window: past {@link FPL_DIGEST_WINDOW_HOURS} ending at `now`. */
export function rollingDigestWindowBounds(now = new Date()): {
  window_start: string;
  window_end: string;
} {
  const endMs = now.getTime();
  const startMs = endMs - FPL_DIGEST_WINDOW_HOURS * 60 * 60 * 1000;
  return {
    window_start: new Date(startMs).toISOString(),
    window_end: new Date(endMs).toISOString(),
  };
}

function inWindow(
  published_at: string | null,
  startMs: number,
  endMs: number,
): boolean {
  if (!published_at) return false;
  const ts = Date.parse(published_at);
  if (!Number.isFinite(ts)) return false;
  return ts >= startMs && ts <= endMs;
}

function mapNewsItemToSource(
  item: WcNewsItem,
  kind: FplXDigestSource["kind"],
): FplXDigestSource {
  return {
    outlet: item.outlet,
    text: (item.summary || item.title).trim(),
    url: item.url,
    published_at: item.published_at,
    kind,
  };
}

function dedupeSources(items: FplXDigestSource[]): FplXDigestSource[] {
  const seen = new Set<string>();
  const out: FplXDigestSource[] = [];
  for (const item of items) {
    const key = item.url.toLowerCase() || item.text.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });
}

async function fetchFfscoutHeadlines(limit: number): Promise<FplXDigestSource[]> {
  return fetchRssHeadlines(FFSCOUT_RSS, "FFScout", limit, FPL_HEADLINE_RE);
}

async function fetchRssHeadlines(
  feedUrl: string,
  outlet: string,
  limit: number,
  titleFilter: RegExp,
): Promise<FplXDigestSource[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const out: FplXDigestSource[] = [];

    for (const block of xml.match(/<item[\s\S]*?<\/item>/gi) ?? []) {
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch =
        block.match(/<link>([\s\S]*?)<\/link>/i) ??
        block.match(/<link[^>]+href=["']([^"']+)["']/i);
      const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const title = (titleMatch?.[1] ?? "")
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#8217;/g, "'")
        .trim();
      const url = (linkMatch?.[1] ?? "").trim();
      if (!title || !url || !titleFilter.test(title)) continue;

      let published_at: string | null = null;
      if (pubMatch?.[1]) {
        const ts = Date.parse(pubMatch[1].trim());
        published_at = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
      }

      out.push({
        outlet,
        text: title,
        url,
        published_at,
        kind: "headline",
      });
      if (out.length >= limit) break;
    }

    return out;
  } catch {
    return [];
  }
}

export async function collectFplXDigestSources(opts?: {
  asOf?: Date;
}): Promise<{
  sources: FplXDigestSource[];
  window_start: string;
  window_end: string;
}> {
  const asOf = opts?.asOf ?? new Date();
  const { window_start, window_end } = rollingDigestWindowBounds(asOf);
  const startMs = Date.parse(window_start);
  const endMs = Date.parse(window_end);

  const sources: FplXDigestSource[] = [];

  const { fetchFplXFromPlEmbeds } = await import("@/lib/fpl/fpl-x-pl-embeds");
  const { fetchFplXTweets, fetchFplJournalistTweetsForDigest } = await import(
    "@/lib/fpl/fpl-x-feed"
  );

  const [embeds, liveTweets, journalistTweets] = await Promise.all([
    fetchFplXFromPlEmbeds({ limit: 25, weekOnly: false }),
    fetchFplXTweets({ limit: 45 }).catch(() => [] as WcNewsItem[]),
    fetchFplJournalistTweetsForDigest({ limit: 28 }).catch(
      () => [] as WcNewsItem[],
    ),
  ]);

  for (const item of [...embeds, ...liveTweets, ...journalistTweets]) {
    if (item.feed_id !== "fpl-x") continue;
    if (inWindow(item.published_at, startMs, endMs)) {
      sources.push(mapNewsItemToSource(item, "tweet"));
    }
  }

  const cached = await loadWcNewsFromDb();
  for (const item of cached.items) {
    if (item.feed_id !== "fpl-x" && item.feed_id !== "pl-official") continue;
    const text = `${item.title} ${item.summary}`;
    if (item.feed_id === "pl-official" && !FPL_HEADLINE_RE.test(text)) continue;
    if (!inWindow(item.published_at, startMs, endMs)) continue;
    sources.push(
      mapNewsItemToSource(
        item,
        item.feed_id === "fpl-x" ? "tweet" : "headline",
      ),
    );
  }

  const { fetchPremierLeagueNewsItems } = await import("@/lib/wc/premierleague-news");
  const plNews = await fetchPremierLeagueNewsItems({ limit: 30 }).catch(
    () => [] as WcNewsItem[],
  );
  for (const item of plNews) {
    const text = `${item.title} ${item.summary}`;
    if (!FPL_HEADLINE_RE.test(text)) continue;
    if (!inWindow(item.published_at, startMs, endMs)) continue;
    sources.push(mapNewsItemToSource(item, "headline"));
  }

  const ffscout = await fetchFfscoutHeadlines(12);
  for (const item of ffscout) {
    if (!inWindow(item.published_at, startMs, endMs)) continue;
    sources.push(item);
  }

  const [bbcPl, guardian] = await Promise.all([
    fetchRssHeadlines(BBC_PL_RSS, "BBC Sport", 10, PL_NEWS_RE),
    fetchRssHeadlines(GUARDIAN_FOOTBALL_RSS, "The Guardian", 10, PL_NEWS_RE),
  ]);
  for (const item of [...bbcPl, ...guardian]) {
    if (!inWindow(item.published_at, startMs, endMs)) continue;
    sources.push(item);
  }

  return {
    sources: dedupeSources(sources),
    window_start,
    window_end,
  };
}

export function digestSourceFingerprint(sources: FplXDigestSource[]): string {
  const payload = sources
    .map(
      (s) =>
        `${s.url}|${s.published_at ?? ""}|${s.text.slice(0, 120)}`,
    )
    .join("\n");
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function formatSourcesBlock(sources: FplXDigestSource[]): string {
  if (sources.length === 0) {
    return "(No FPL-related posts or headlines were collected for this window.)";
  }

  return sources
    .map((s, i) => {
      const when = s.published_at
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: FPL_DIGEST_TZ,
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(s.published_at))
        : "time unknown";
      return `${i + 1}. [${s.kind}] ${s.outlet} (${when})\n   ${s.text}\n   URL: ${s.url}`;
    })
    .join("\n\n");
}

function templateDigest(
  digestDate: string,
  sources: FplXDigestSource[],
): string {
  const official = sources.filter((s) => /fpl official|officialfpl/i.test(s.outlet));
  const journalists = sources.filter(
    (s) =>
      s.kind === "tweet" &&
      /bbc|ornstein|romano|joyce|pearce|stone|slater|bascombe|king|mokbel|burt|mcgrath|whitwell|kilpatrick|watts|lee|crafton|dorsett|ashton|cross|hughes|ogden|thomas|ames|lawton|steinberg/i.test(
        s.outlet,
      ),
  );
  const headlines = sources.filter((s) => s.kind === "headline");
  const community = sources.filter(
    (s) =>
      s.kind === "tweet" &&
      !/fpl official|officialfpl/i.test(s.outlet) &&
      !journalists.includes(s),
  );

  const sections: string[] = [];

  if (official.length) {
    const bullets = official
      .slice(0, 4)
      .map((s) => `- ${s.text.replace(/pic\.twitter\.com\/\S+/g, "").trim()} (${s.outlet})`);
    sections.push(`## Official FPL\n${bullets.join("\n")}`);
  }

  const injuryLineup = [...journalists, ...headlines].filter((s) =>
    /injur|doubtful|ruled out|line-?up|team news|fitness|scan|sidelined|starting|bench|press conference/i.test(
      s.text,
    ),
  );
  if (injuryLineup.length) {
    const bullets = injuryLineup
      .slice(0, 8)
      .map((s) => `- ${s.text.slice(0, 200)} (${s.outlet})`);
    sections.push(`## Injuries & team news\n${bullets.join("\n")}`);
  }

  const transfers = [...journalists, ...headlines, ...community].filter((s) =>
    /transfer|sign(?:ing|ed|s)?|loan|bid|deal|here we go|agreed|medical|target/i.test(
      s.text,
    ),
  );
  if (transfers.length) {
    const bullets = transfers
      .slice(0, 8)
      .map((s) => `- ${s.text.slice(0, 200)} (${s.outlet})`);
    sections.push(`## Transfers\n${bullets.join("\n")}`);
  }

  if (community.length) {
    const bullets = community
      .slice(0, 5)
      .map((s) => `- ${s.text.slice(0, 180)} (${s.outlet})`);
    sections.push(`## FPL community\n${bullets.join("\n")}`);
  }

  if (!sections.length) {
    return `## Quiet day\n- No major FPL or Premier League updates in the past ${FPL_DIGEST_WINDOW_HOURS} hours (${digestDate}). Check back after the next sync.`;
  }

  return sections.join("\n\n");
}

async function generateDigestWithGemini(
  digestDate: string,
  windowStart: string,
  windowEnd: string,
  sources: FplXDigestSource[],
  locale: "en" | "zh",
): Promise<string | null> {
  try {
    const ai = await getGenAI();
    const facts = formatSourcesBlock(sources);
    const windowLabel = `${windowStart.slice(0, 16)} → ${windowEnd.slice(0, 16)} UTC`;

    const prompt =
      locale === "zh"
        ? `请根据以下素材撰写 FPL（Fantasy Premier League）每日简报。
时间窗口：过去 ${FPL_DIGEST_WINDOW_HOURS} 小时（约 ${windowLabel}，以 ${digestDate} 为发布日）。
仅使用所给素材，不得编造转会、伤病或官方公告。

素材：
${facts}

格式（Markdown，务必遵守）：
## 官方 FPL
- 最多 4 条要点

## 伤病与阵容
- 最多 8 条：球员 + 俱乐部 + 状态/预计出场（有则写）

## 转会
- 最多 8 条：具体人名/俱乐部 + 来源

## FPL 社区
- 最多 5 条（仅在有价值时写）

规则：
- 全文 ≤${FPL_DIGEST_SUMMARY_MAX_CHARS_ZH} 字，每条要点一行，信息密度高，可写得更完整
- 每条末尾标注来源（@账号 或媒体名）
- 无内容的板块整段省略
- 不要开篇套话或结尾废话`
        : `Write an FPL (Fantasy Premier League) daily briefing for managers.
Window: the past ${FPL_DIGEST_WINDOW_HOURS} hours (approx ${windowLabel}; digest date ${digestDate}).
Use ONLY the sources below — do not invent injuries, transfers, or official announcements.

Sources:
${facts}

Format (Markdown — follow exactly):
## Official FPL
- up to 4 bullets

## Injuries & team news
- up to 8 bullets: player + club + status/availability (when known)

## Transfers
- up to 8 bullets: named players/clubs + source

## FPL community
- up to 5 bullets (only if genuinely useful)

Rules:
- ≤${FPL_DIGEST_SUMMARY_MAX_WORDS} words total; one fact per bullet; high information density; fuller detail is welcome
- End each bullet with the source (@handle or outlet)
- Omit entire sections with no supporting sources
- No intro fluff or closing paragraph
- Prefer PL beat journalists (Ornstein, Romano, Stone, Pearce, etc.) for injury/transfer facts when present`;

    const resp = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: locale === "zh" ? 0.35 : 0.45 },
    });

    const text = (resp.candidates?.[0]?.content?.parts ?? [])
      .map((p) => ("text" in p ? p.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch {
    return null;
  }
}

async function loadCachedDigest(
  digestDate: string,
  fingerprint: string,
): Promise<FplXDigestRecord | null> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("fpl_x_digests")
      .select("*")
      .eq("digest_date", digestDate)
      .maybeSingle();
    if (error || !data) return null;
    if (data.source_fingerprint !== fingerprint) return null;

    return rowToFplXDigestRecord(data as Record<string, unknown>, digestDate);
  } catch {
    return null;
  }
}

async function saveDigestToCacheFallback(
  record: Omit<FplXDigestRecord, "source">,
): Promise<void> {
  const supa = getServerSupabase();
  const { error } = await supa.from("wc_news_cache").upsert({
    id: `fpl-digest:${record.digest_date}`,
    items: record,
    fetched_at: record.generated_at,
  });
  if (error) throw new Error(error.message);
}

async function loadCachedDigestFallback(
  digestDate: string,
  fingerprint: string,
): Promise<FplXDigestRecord | null> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("wc_news_cache")
      .select("items, fetched_at")
      .eq("id", `fpl-digest:${digestDate}`)
      .maybeSingle();
    if (error || !data?.items) return null;
    const raw = data.items as Omit<FplXDigestRecord, "source"> & {
      source_fingerprint?: string;
    };
    if (raw.source_fingerprint !== fingerprint) return null;
    return { ...raw, source: "cache" };
  } catch {
    return null;
  }
}

async function saveDigest(record: Omit<FplXDigestRecord, "source">): Promise<void> {
  const supa = getServerSupabase();
  const { error } = await supa.from("fpl_x_digests").upsert({
    digest_date: record.digest_date,
    window_start: record.window_start,
    window_end: record.window_end,
    summary_json: {
      en: record.summary_en,
      zh: record.summary_zh,
    },
    source_items: record.source_items,
    source_fingerprint: record.source_fingerprint,
    model: record.model,
    generated_at: record.generated_at,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/fpl_x_digests|schema cache/i.test(error.message)) {
      await saveDigestToCacheFallback(record);
      return;
    }
    throw new Error(error.message);
  }
}

export async function getOrCreateFplXDigest(opts?: {
  digestDate?: string;
  force?: boolean;
  asOf?: Date;
}): Promise<FplXDigestRecord> {
  const asOf = opts?.asOf ?? new Date();
  const digestDate = opts?.digestDate ?? londonDigestDateIso(asOf);
  const { sources, window_start, window_end } = await collectFplXDigestSources({
    asOf,
  });
  const fingerprint = digestSourceFingerprint(sources);

  if (!opts?.force) {
    const cached = await loadCachedDigest(digestDate, fingerprint);
    if (cached) return cached;
    const fallback = await loadCachedDigestFallback(digestDate, fingerprint);
    if (fallback) return fallback;
  }

  const geminiEn = await generateDigestWithGemini(
    digestDate,
    window_start,
    window_end,
    sources,
    "en",
  );
  const summaryEn = geminiEn ?? templateDigest(digestDate, sources);
  const usedGemini = Boolean(geminiEn);

  const summaryZh = usedGemini
    ? await generateDigestWithGemini(
        digestDate,
        window_start,
        window_end,
        sources,
        "zh",
      )
    : null;

  const generated_at = new Date().toISOString();
  const record: FplXDigestRecord = {
    digest_date: digestDate,
    window_start,
    window_end,
    summary_en: summaryEn,
    summary_zh: summaryZh,
    source_items: sources,
    source_fingerprint: fingerprint,
    model: usedGemini ? DEFAULT_MODEL : null,
    generated_at,
    source: usedGemini ? "gemini" : "template",
  };

  await saveDigest(record);
  return record;
}

export async function loadFplXDigestFromDb(
  digestDate: string,
): Promise<FplXDigestRecord | null> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("fpl_x_digests")
      .select("*")
      .eq("digest_date", digestDate)
      .maybeSingle();
    if (!error && data) {
      return rowToFplXDigestRecord(data as Record<string, unknown>, digestDate);
    }

    const { data: fb, error: fbErr } = await supa
      .from("wc_news_cache")
      .select("items, fetched_at")
      .eq("id", `fpl-digest:${digestDate}`)
      .maybeSingle();
    if (fbErr || !fb?.items) return null;
    const raw = fb.items as Omit<FplXDigestRecord, "source">;
    return { ...raw, source: "cache" };
  } catch {
    return null;
  }
}

export function pickDigestSummary(
  record: Pick<FplXDigestRecord, "summary_en" | "summary_zh">,
  locale = "en",
): string {
  return locale.toLowerCase().startsWith("zh") && record.summary_zh
    ? record.summary_zh
    : record.summary_en;
}

function rowToFplXDigestRecord(
  data: Record<string, unknown>,
  digestDate?: string,
): FplXDigestRecord {
  const summaryJson =
    (data.summary_json as Record<string, string | null> | null) ?? {};
  return {
    digest_date: (digestDate ?? data.digest_date) as string,
    window_start: data.window_start as string,
    window_end: data.window_end as string,
    summary_en: summaryJson.en ?? "",
    summary_zh: summaryJson.zh ?? null,
    source_items: (data.source_items as FplXDigestSource[]) ?? [],
    source_fingerprint: data.source_fingerprint as string,
    model: (data.model as string | null) ?? null,
    generated_at: data.generated_at as string,
    source: "cache",
  };
}

export async function listArchivedFplXDigests(opts?: {
  limit?: number;
  locale?: string;
  beforeDate?: string;
}): Promise<Array<FplXDigestRecord & { summary: string }>> {
  const limit = opts?.limit ?? 30;
  const beforeDate = opts?.beforeDate ?? londonDigestDateIso();
  const locale = opts?.locale ?? "en";

  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("fpl_x_digests")
      .select("*")
      .lt("digest_date", beforeDate)
      .order("digest_date", { ascending: false })
      .limit(limit);

    if (!error && data?.length) {
      return data.map((row) => {
        const record = rowToFplXDigestRecord(row as Record<string, unknown>);
        return { ...record, summary: pickDigestSummary(record, locale) };
      });
    }

    const { data: fb } = await supa
      .from("wc_news_cache")
      .select("id, items, fetched_at")
      .like("id", "fpl-digest:%")
      .order("fetched_at", { ascending: false })
      .limit(limit + 5);

    const out: Array<FplXDigestRecord & { summary: string }> = [];
    for (const row of fb ?? []) {
      const raw = row.items as Omit<FplXDigestRecord, "source">;
      if (!raw?.digest_date || raw.digest_date >= beforeDate) continue;
      const record: FplXDigestRecord = { ...raw, source: "cache" };
      out.push({ ...record, summary: pickDigestSummary(record, locale) });
      if (out.length >= limit) break;
    }
    return out.sort((a, b) => b.digest_date.localeCompare(a.digest_date));
  } catch {
    return [];
  }
}

export async function listRecentFplXDigests(limit = 7): Promise<
  Array<Pick<FplXDigestRecord, "digest_date" | "generated_at" | "summary_en">>
> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("fpl_x_digests")
      .select("digest_date, generated_at, summary_json")
      .order("digest_date", { ascending: false })
      .limit(limit);
    if (!error && data?.length) {
      return data.map((row) => {
        const summaryJson =
          (row.summary_json as Record<string, string | null> | null) ?? {};
        return {
          digest_date: row.digest_date as string,
          generated_at: row.generated_at as string,
          summary_en: summaryJson.en ?? "",
        };
      });
    }

    const { data: fb } = await supa
      .from("wc_news_cache")
      .select("id, items, fetched_at")
      .like("id", "fpl-digest:%")
      .order("fetched_at", { ascending: false })
      .limit(limit);
    return (fb ?? []).map((row) => {
      const raw = row.items as Omit<FplXDigestRecord, "source">;
      return {
        digest_date: raw.digest_date,
        generated_at: raw.generated_at ?? (row.fetched_at as string),
        summary_en: raw.summary_en ?? "",
      };
    });
  } catch {
    return [];
  }
}

export async function syncFplXDigest(opts?: {
  digestDate?: string;
  force?: boolean;
  asOf?: Date;
}): Promise<FplXDigestRecord> {
  return getOrCreateFplXDigest({
    digestDate: opts?.digestDate,
    force: opts?.force,
    asOf: opts?.asOf,
  });
}
