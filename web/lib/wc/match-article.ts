import { getServerSupabase } from "@/lib/supabase";
import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";
import { buildMatchEnrichment, type SummaryLocale } from "@/lib/wc/match-enrichment";
import {
  buildFactsBlock,
  matchSummaryFingerprint,
} from "@/lib/wc/match-summary";
import {
  buildWcMatchSchedule,
  isWcMatchFinished,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";

export type MatchArticle = {
  headline: string;
  body: string;
  kind: "report" | "preview";
};

export type MatchArticleResult = MatchArticle & {
  source: "cache" | "gemini" | "template";
  fingerprint: string;
};

function normalizeLocale(locale: string): SummaryLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function appendTeamStatsBlock(
  facts: string,
  match: WcMatchRow,
  locale: SummaryLocale,
): string {
  const hs = match.home_stats;
  const as = match.away_stats;
  if (!match.stats_available || (!hs && !as)) return facts;

  const lines: string[] = [facts, ""];
  if (locale === "zh") {
    lines.push("比赛统计（若可用）：");
    if (hs) {
      lines.push(
        `${match.home_name}：xG ${hs.xg ?? "—"}，射门 ${hs.shots ?? "—"}，射正 ${hs.shots_on_target ?? "—"}，控球 ${hs.possession != null ? `${hs.possession}%` : "—"}`,
      );
    }
    if (as) {
      lines.push(
        `${match.away_name}：xG ${as.xg ?? "—"}，射门 ${as.shots ?? "—"}，射正 ${as.shots_on_target ?? "—"}，控球 ${as.possession != null ? `${as.possession}%` : "—"}`,
      );
    }
  } else {
    lines.push("Match statistics (when available):");
    if (hs) {
      lines.push(
        `${match.home_name}: xG ${hs.xg ?? "—"}, shots ${hs.shots ?? "—"}, on target ${hs.shots_on_target ?? "—"}, possession ${hs.possession != null ? `${hs.possession}%` : "—"}`,
      );
    }
    if (as) {
      lines.push(
        `${match.away_name}: xG ${as.xg ?? "—"}, shots ${as.shots ?? "—"}, on target ${as.shots_on_target ?? "—"}, possession ${as.possession != null ? `${as.possession}%` : "—"}`,
      );
    }
  }
  return lines.join("\n");
}

function articleFingerprint(
  match: WcMatchRow,
  enrichment: Awaited<ReturnType<typeof buildMatchEnrichment>>,
): string {
  return `article_v1:${matchSummaryFingerprint(match, enrichment)}`;
}

function templateArticle(
  match: WcMatchRow,
  locale: SummaryLocale,
  kind: "report" | "preview",
): MatchArticle {
  const home = match.home_name;
  const away = match.away_name;

  if (kind === "preview") {
    if (locale === "zh") {
      return {
        headline: `${home} 对阵 ${away}：世界杯前瞻`,
        body: `${match.round_label} 即将上演 ${home} 与 ${away} 的对决${match.venue ? `，场地为 ${match.venue}` : ""}。两队都将为小组出线形势全力以赴。请关注赛前阵容与关键球员状态。`,
        kind,
      };
    }
    return {
      headline: `${home} vs ${away}: World Cup preview`,
      body: `${home} meet ${away} in ${match.round_label}${match.venue ? ` at ${match.venue}` : ""}. Both sides will chase group-stage points with knockout qualification on the line. Watch team news and form before kickoff.`,
      kind,
    };
  }

  const hs = match.home_score ?? 0;
  const as = match.away_score ?? 0;
  if (locale === "zh") {
    let result: string;
    if (hs > as) result = `${home} ${hs}-${as} 战胜 ${away}`;
    else if (as > hs) result = `${away} ${as}-${hs} 战胜 ${home}`;
    else result = `${home} 与 ${away} ${hs}-${as} 战平`;

    return {
      headline: `${result}：${match.round_label} 战报`,
      body: `${match.round_label}，${result}${match.venue ? `（${match.venue}）` : ""}。比赛已结束，更多细节请查看比分与时间线。`,
      kind,
    };
  }

  let result: string;
  if (hs > as) result = `${home} beat ${away} ${hs}-${as}`;
  else if (as > hs) result = `${away} beat ${home} ${as}-${hs}`;
  else result = `${home} and ${away} drew ${hs}-${as}`;

  return {
    headline: `${result} — ${match.round_label} report`,
    body: `In ${match.round_label}, ${result}${match.venue ? ` at ${match.venue}` : ""}. Full-time at the whistle — see the timeline for goals and cards.`,
    kind,
  };
}

async function loadCachedArticle(
  matchId: number,
  locale: SummaryLocale,
  fingerprint: string,
): Promise<MatchArticle | null> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("wc_match_stats")
      .select("article_json, article_fingerprint")
      .eq("fifa_tournament_id", matchId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.article_fingerprint !== fingerprint) return null;
    const json = data.article_json as Record<string, MatchArticle> | null;
    const hit = json?.[locale];
    if (!hit?.headline?.trim() || !hit?.body?.trim()) return null;
    return hit;
  } catch {
    return null;
  }
}

async function saveCachedArticle(
  match: WcMatchRow,
  locale: SummaryLocale,
  article: MatchArticle,
  fingerprint: string,
): Promise<void> {
  try {
    const supa = getServerSupabase();
    const { data: existing } = await supa
      .from("wc_match_stats")
      .select("article_json")
      .eq("fifa_tournament_id", match.id)
      .maybeSingle();

    const prev =
      (existing?.article_json as Record<string, MatchArticle> | null) ?? {};
    const article_json = { ...prev, [locale]: article };

    await supa.from("wc_match_stats").upsert(
      {
        fifa_tournament_id: match.id,
        round_id: match.round_id,
        kickoff: match.kickoff,
        venue: match.venue,
        venue_city: match.venue_city,
        status: match.status,
        home_code: match.home_code,
        away_code: match.away_code,
        home_name: match.home_name,
        away_name: match.away_name,
        home_score: match.home_score,
        away_score: match.away_score,
        article_json,
        article_fingerprint: fingerprint,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fifa_tournament_id" },
    );
  } catch {
    /* cache optional */
  }
}

async function generateWithGemini(
  match: WcMatchRow,
  facts: string,
  locale: SummaryLocale,
  kind: "report" | "preview",
): Promise<MatchArticle | null> {
  try {
    const ai = await getGenAI();

    const prompt =
      locale === "zh"
        ? kind === "preview"
          ? `你是一名世界杯专栏作者。根据以下素材撰写赛前分析文章。
仅使用所给事实，不得编造球员、比分或事件。

${facts}

输出格式（严格遵守）：
第一行：HEADLINE: （一行标题，不超过 28 字）
空一行
正文 4–5 段 Markdown，总字数 380–520 字，包含：
## 比赛背景
## 两队近况与关键球员
## 战术看点
## 小组形势
## 观赛提示

要求：简体中文；专业、有观点但不编造；不要用项目符号列表，每节 1–2 段 prose。`
          : `你是一名世界杯专栏作者。根据以下素材撰写赛后深度分析。
仅使用所给事实，不得编造球员、比分、时间或事件。

${facts}

输出格式（严格遵守）：
第一行：HEADLINE: （一行标题，不超过 28 字）
空一行
正文 4–6 段 Markdown，总字数 420–580 字，包含：
## 比赛概览
## 关键瞬间
## 战术解读
## 数据与表现
## 小组影响
## 后续展望

要求：简体中文；专业赛后分析语气；不要用项目符号列表，每节 1–2 段 prose。`
        : kind === "preview"
          ? `You are a World Cup feature writer. Write a pre-match preview from these facts only — do not invent players, scores, or events.

${facts}

Format (strict):
Line 1: HEADLINE: (one headline, max 12 words)
Blank line
Body in Markdown, 4–5 sections, 380–520 words total:
## Match context
## Form & players to watch
## Tactical angles
## Group stakes
## What to expect

English only. Confident editorial tone. No bullet lists — prose paragraphs under each heading.`
          : `You are a World Cup feature writer. Write a post-match analysis from these facts only — do not invent players, scores, minutes, or events.

${facts}

Format (strict):
Line 1: HEADLINE: (one headline, max 12 words)
Blank line
Body in Markdown, 4–6 sections, 420–580 words total:
## The story
## Key moments
## Tactical read
## By the numbers
## Group impact
## What's next

English only. Engaging long-form tone. No bullet lists — prose paragraphs under each heading.`;

    const resp = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: locale === "zh" ? 0.45 : 0.55 },
    });

    const text = (resp.candidates?.[0]?.content?.parts ?? [])
      .map((p) => ("text" in p ? p.text : ""))
      .join("")
      .trim();
    if (!text) return null;

    const headlineMatch = text.match(/^HEADLINE:\s*(.+?)(?:\n|$)/i);
    const headline = headlineMatch?.[1]?.trim() ?? "";
    const body = text.replace(/^HEADLINE:\s*.+?\n+/i, "").trim();
    if (!headline || !body) return null;

    return { headline, body, kind };
  } catch {
    return null;
  }
}

export function canWriteMatchArticle(match: WcMatchRow): boolean {
  if (isWcMatchFinished(match)) return true;
  const status = match.status.toLowerCase();
  if (status === "scheduled" || status === "not_started" || status === "upcoming") {
    return Boolean(match.kickoff);
  }
  return false;
}

export function articleKindForMatch(match: WcMatchRow): "report" | "preview" {
  return isWcMatchFinished(match) ? "report" : "preview";
}

export async function getOrCreateMatchArticle(
  match: WcMatchRow,
  localeInput: string,
  allMatches?: WcMatchRow[],
): Promise<MatchArticleResult> {
  const locale = normalizeLocale(localeInput);
  const kind = articleKindForMatch(match);
  const schedule: WcMatchRow[] =
    allMatches ?? (await buildWcMatchSchedule()).matches;
  const enrichment = await buildMatchEnrichment(match, schedule, locale);
  const fingerprint = articleFingerprint(match, enrichment);

  const cached = await loadCachedArticle(match.id, locale, fingerprint);
  if (cached) {
    return { ...cached, source: "cache", fingerprint };
  }

  let facts = buildFactsBlock(match, enrichment, locale);
  if (kind === "report") {
    facts = appendTeamStatsBlock(facts, match, locale);
  }

  const gemini = await generateWithGemini(match, facts, locale, kind);
  if (gemini) {
    await saveCachedArticle(match, locale, gemini, fingerprint);
    return { ...gemini, source: "gemini", fingerprint };
  }

  const template = templateArticle(match, locale, kind);
  await saveCachedArticle(match, locale, template, fingerprint);
  return { ...template, source: "template", fingerprint };
}
