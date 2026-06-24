import { getServerSupabase } from "@/lib/supabase";
import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";
import {
  buildMatchEnrichment,
  formatEnrichmentFacts,
  formatMatchTimeline,
  roundLabelForLocale,
  type MatchEnrichment,
  type SummaryLocale,
} from "@/lib/wc/match-enrichment";
import {
  buildFactsBlock,
  matchSummaryFingerprint,
} from "@/lib/wc/match-summary";
import { displayTeamName } from "@/lib/wc/team-names-zh";
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

const MIN_ARTICLE_BODY_CHARS = 280;

function normalizeLocale(locale: string): SummaryLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function teamNames(
  match: WcMatchRow,
  locale: SummaryLocale,
): { home: string; away: string } {
  return {
    home: displayTeamName(match.home_code, match.home_name, locale),
    away: displayTeamName(match.away_code, match.away_name, locale),
  };
}

function localizeFactsBlock(
  facts: string,
  match: WcMatchRow,
  locale: SummaryLocale,
): string {
  if (locale !== "zh") return facts;
  const { home, away } = teamNames(match, locale);
  return facts
    .replaceAll(match.home_name, home)
    .replaceAll(match.away_name, away);
}

function appendTeamStatsBlock(
  facts: string,
  match: WcMatchRow,
  locale: SummaryLocale,
): string {
  const hs = match.home_stats;
  const as = match.away_stats;
  if (!match.stats_available || (!hs && !as)) return facts;

  const { home, away } = teamNames(match, locale);
  const lines: string[] = [facts, ""];
  if (locale === "zh") {
    lines.push("比赛统计（若可用）：");
    if (hs) {
      lines.push(
        `${home}：xG ${hs.xg ?? "—"}，射门 ${hs.shots ?? "—"}，射正 ${hs.shots_on_target ?? "—"}，控球 ${hs.possession != null ? `${hs.possession}%` : "—"}`,
      );
    }
    if (as) {
      lines.push(
        `${away}：xG ${as.xg ?? "—"}，射门 ${as.shots ?? "—"}，射正 ${as.shots_on_target ?? "—"}，控球 ${as.possession != null ? `${as.possession}%` : "—"}`,
      );
    }
  } else {
    lines.push("Match statistics (when available):");
    if (hs) {
      lines.push(
        `${home}: xG ${hs.xg ?? "—"}, shots ${hs.shots ?? "—"}, on target ${hs.shots_on_target ?? "—"}, possession ${hs.possession != null ? `${hs.possession}%` : "—"}`,
      );
    }
    if (as) {
      lines.push(
        `${away}: xG ${as.xg ?? "—"}, shots ${as.shots ?? "—"}, on target ${as.shots_on_target ?? "—"}, possession ${as.possession != null ? `${as.possession}%` : "—"}`,
      );
    }
  }
  return lines.join("\n");
}

function articleFingerprint(
  match: WcMatchRow,
  enrichment: MatchEnrichment,
): string {
  return `article_v2:${matchSummaryFingerprint(match, enrichment)}`;
}

function scoreResultLine(
  match: WcMatchRow,
  locale: SummaryLocale,
): string {
  const { home, away } = teamNames(match, locale);
  const hs = match.home_score ?? 0;
  const as = match.away_score ?? 0;

  if (locale === "zh") {
    if (hs > as) return `${home} 以 ${hs}-${as} 战胜 ${away}`;
    if (as > hs) return `${away} 以 ${as}-${hs} 战胜 ${home}`;
    return `${home} 与 ${away} ${hs}-${as} 战平`;
  }
  if (hs > as) return `${home} beat ${away} ${hs}-${as}`;
  if (as > hs) return `${away} beat ${home} ${as}-${hs}`;
  return `${home} and ${away} drew ${hs}-${as}`;
}

function richTemplateArticle(
  match: WcMatchRow,
  enrichment: MatchEnrichment,
  locale: SummaryLocale,
  kind: "report" | "preview",
): MatchArticle {
  const { home, away } = teamNames(match, locale);
  const round = roundLabelForLocale(match, locale);
  const venue = match.venue ?? (locale === "zh" ? "待定球场" : "TBC");
  const timeline = formatMatchTimeline(match, locale);
  const context = formatEnrichmentFacts(match, enrichment, locale);

  if (kind === "preview") {
    const headline =
      locale === "zh"
        ? `${home} 对阵 ${away}：世界杯前瞻`
        : `${home} vs ${away}: World Cup preview`;

    const sections: string[] = [];
    if (locale === "zh") {
      sections.push(
        `## 比赛背景\n\n${round}，${home} 将在 ${venue} 迎战 ${away}。${enrichment.matchDetail}`,
        `## 两队走势\n\n${home} 赛前：${enrichment.homeForm}。${away} 赛前：${enrichment.awayForm}。`,
      );
      if (enrichment.groupTable) {
        sections.push(`## 小组形势\n\n${enrichment.groupTable}`);
      } else if (enrichment.homeStandingLine || enrichment.awayStandingLine) {
        const lines = [enrichment.homeStandingLine, enrichment.awayStandingLine]
          .filter(Boolean)
          .join("\n");
        sections.push(`## 小组形势\n\n${lines}`);
      }
      sections.push(
        `## 观赛提示\n\n两队都将为出线形势全力以赴。请关注赛前阵容、伤病与关键球员状态，开球时间 ${match.kickoff?.slice(0, 16).replace("T", " ") ?? "待定"}。`,
      );
    } else {
      sections.push(
        `## Match context\n\n${home} host ${away} in ${round} at ${venue}. ${enrichment.matchDetail}`,
        `## Form check\n\n${home} before kickoff: ${enrichment.homeForm}. ${away}: ${enrichment.awayForm}.`,
      );
      if (enrichment.groupTable) {
        sections.push(`## Group stakes\n\n${enrichment.groupTable}`);
      } else if (enrichment.homeStandingLine || enrichment.awayStandingLine) {
        const lines = [enrichment.homeStandingLine, enrichment.awayStandingLine]
          .filter(Boolean)
          .join("\n");
        sections.push(`## Group stakes\n\n${lines}`);
      }
      sections.push(
        `## What to watch\n\nBoth sides need points with qualification on the line. Track team news and key players ahead of kickoff${match.kickoff ? ` on ${match.kickoff.slice(0, 16).replace("T", " ")}` : ""}.`,
      );
    }

    return { headline, body: sections.join("\n\n"), kind };
  }

  const result = scoreResultLine(match, locale);
  const headline =
    locale === "zh" ? `${result}：${round} 战报` : `${result} — ${round} report`;

  const sections: string[] = [];
  if (locale === "zh") {
    sections.push(
      `## 比赛概览\n\n${round}，${result}，比赛在 ${venue} 结束。${enrichment.matchDetail}`,
    );
    if (timeline) {
      sections.push(`## 关键瞬间\n\n${timeline.replace(/\n/g, "；")}`);
    } else {
      const hs = match.home_score ?? 0;
      const as = match.away_score ?? 0;
      sections.push(
        `## 关键瞬间\n\n${hs === 0 && as === 0 ? `双方均未能破门，${home} 与 ${away} 互交白卷。` : `请结合比分与时间线回顾比赛进程。`}`,
      );
    }
    if (match.stats_available && (match.home_stats || match.away_stats)) {
      const statLines: string[] = [];
      const hst = match.home_stats;
      const ast = match.away_stats;
      if (hst) {
        statLines.push(
          `${home}：xG ${hst.xg ?? "—"}，射门 ${hst.shots ?? "—"}，射正 ${hst.shots_on_target ?? "—"}${hst.possession != null ? `，控球 ${hst.possession}%` : ""}`,
        );
      }
      if (ast) {
        statLines.push(
          `${away}：xG ${ast.xg ?? "—"}，射门 ${ast.shots ?? "—"}，射正 ${ast.shots_on_target ?? "—"}${ast.possession != null ? `，控球 ${ast.possession}%` : ""}`,
        );
      }
      sections.push(`## 数据与表现\n\n${statLines.join("。")}。`);
    }
    if (enrichment.groupTable) {
      sections.push(`## 小组影响\n\n${enrichment.groupTable}`);
    }
    sections.push(
      `## 后续展望\n\n${home} 与 ${away} 的出线形势将随同组赛果继续变化。${context.split("\n").slice(0, 2).join(" ")}`,
    );
  } else {
    sections.push(
      `## The story\n\n${result} in ${round} at ${venue}. ${enrichment.matchDetail}`,
    );
    if (timeline) {
      sections.push(`## Key moments\n\n${timeline.replace(/\n/g, "; ")}`);
    } else {
      sections.push(
        `## Key moments\n\nThe scoreline tells the story — see how each side created chances across 90 minutes.`,
      );
    }
    if (match.stats_available && (match.home_stats || match.away_stats)) {
      const statLines: string[] = [];
      const hst = match.home_stats;
      const ast = match.away_stats;
      if (hst) {
        statLines.push(
          `${home}: xG ${hst.xg ?? "—"}, shots ${hst.shots ?? "—"}, on target ${hst.shots_on_target ?? "—"}${hst.possession != null ? `, possession ${hst.possession}%` : ""}`,
        );
      }
      if (ast) {
        statLines.push(
          `${away}: xG ${ast.xg ?? "—"}, shots ${ast.shots ?? "—"}, on target ${ast.shots_on_target ?? "—"}${ast.possession != null ? `, possession ${ast.possession}%` : ""}`,
        );
      }
      sections.push(`## By the numbers\n\n${statLines.join(". ")}.`);
    }
    if (enrichment.groupTable) {
      sections.push(`## Group impact\n\n${enrichment.groupTable}`);
    }
    sections.push(
      `## What's next\n\nQualification paths for ${home} and ${away} will shift with every result in the group.`,
    );
  }

  return { headline, body: sections.join("\n\n"), kind };
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
    if (hit.body.trim().length < MIN_ARTICLE_BODY_CHARS) return null;
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
  if (article.body.trim().length < MIN_ARTICLE_BODY_CHARS) return;

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

function parseGeminiArticle(
  text: string,
  kind: "report" | "preview",
  fallbackHeadline: string,
): MatchArticle | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const jsonBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonBlock) as { headline?: string; body?: string };
    const headline = parsed.headline?.trim();
    const body = parsed.body?.trim();
    if (headline && body && body.length >= MIN_ARTICLE_BODY_CHARS) {
      return { headline, body, kind };
    }
  } catch {
    /* not JSON */
  }

  const headlineMatch = trimmed.match(/^HEADLINE:\s*(.+?)(?:\n|$)/im);
  if (headlineMatch) {
    const body = trimmed.replace(/^HEADLINE:\s*.+?\n+/im, "").trim();
    if (body.length >= MIN_ARTICLE_BODY_CHARS) {
      return { headline: headlineMatch[1].trim(), body, kind };
    }
  }

  const mdMatch = trimmed.match(/^#\s+(.+?)\n+([\s\S]+)$/);
  if (mdMatch && mdMatch[2].trim().length >= MIN_ARTICLE_BODY_CHARS) {
    return { headline: mdMatch[1].trim(), body: mdMatch[2].trim(), kind };
  }

  if (trimmed.includes("##") && trimmed.length >= MIN_ARTICLE_BODY_CHARS) {
    return { headline: fallbackHeadline, body: trimmed, kind };
  }

  return null;
}

async function generateWithGemini(
  match: WcMatchRow,
  facts: string,
  locale: SummaryLocale,
  kind: "report" | "preview",
  fallbackHeadline: string,
): Promise<MatchArticle | null> {
  try {
    const ai = await getGenAI();
    const { home, away } = teamNames(match, locale);

    const prompt =
      locale === "zh"
        ? kind === "preview"
          ? `你是一名世界杯专栏作者。根据以下素材撰写赛前分析文章。
仅使用所给事实，不得编造球员、比分或事件。
正文必须使用简体中文；球队名请使用：${home}、${away}。

${facts}

输出格式：只输出一段 JSON，不要 markdown 代码块或其它说明文字：
{"headline":"一行标题（不超过28字）","body":"Markdown 正文"}

正文要求 4–5 个 ## 小节，总字数 280–380 字，包含：比赛背景、两队近况与关键球员、战术看点、小组形势、观赛提示。每节 1–2 段 prose，不要用项目符号。`
          : `你是一名世界杯专栏作者。根据以下素材撰写赛后深度分析。
仅使用所给事实，不得编造球员、比分、时间或事件。
正文必须使用简体中文；球队名请使用：${home}、${away}。

${facts}

输出格式：只输出一段 JSON，不要 markdown 代码块或其它说明文字：
{"headline":"一行标题（不超过28字）","body":"Markdown 正文"}

正文要求 4–6 个 ## 小节，总字数 300–420 字，包含：比赛概览、关键瞬间、战术解读、数据与表现、小组影响、后续展望。每节 1–2 段 prose，不要用项目符号。`
        : kind === "preview"
          ? `You are a World Cup feature writer. Write a pre-match preview from these facts only — do not invent players, scores, or events.
Use team names: ${home}, ${away}.

${facts}

Output ONLY one JSON object (no markdown fences or extra text):
{"headline":"One headline, max 12 words","body":"Markdown body"}

Body: 4–5 ## sections, 250–350 words total — match context, form & players, tactical angles, group stakes, what to expect. Prose paragraphs only, no bullet lists.`
          : `You are a World Cup feature writer. Write a post-match analysis from these facts only — do not invent players, scores, minutes, or events.
Use team names: ${home}, ${away}.

${facts}

Output ONLY one JSON object (no markdown fences or extra text):
{"headline":"One headline, max 12 words","body":"Markdown body"}

Body: 4–6 ## sections, 280–380 words total — the story, key moments, tactical read, by the numbers, group impact, what's next. Prose paragraphs only, no bullet lists.`;

    const resp = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: locale === "zh" ? 0.45 : 0.55 },
    });

    const text = (resp.candidates?.[0]?.content?.parts ?? [])
      .map((p) => ("text" in p ? p.text : ""))
      .join("")
      .trim();

    return parseGeminiArticle(text, kind, fallbackHeadline);
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

  let facts = localizeFactsBlock(
    buildFactsBlock(match, enrichment, locale),
    match,
    locale,
  );
  if (kind === "report") {
    facts = appendTeamStatsBlock(facts, match, locale);
  }

  const fallback = richTemplateArticle(match, enrichment, locale, kind);

  let gemini = await generateWithGemini(match, facts, locale, kind, fallback.headline);
  if (!gemini) {
    gemini = await generateWithGemini(match, facts, locale, kind, fallback.headline);
  }

  if (gemini) {
    await saveCachedArticle(match, locale, gemini, fingerprint);
    return { ...gemini, source: "gemini", fingerprint };
  }

  if (fallback.body.trim().length >= MIN_ARTICLE_BODY_CHARS) {
    await saveCachedArticle(match, locale, fallback, fingerprint);
  }
  return { ...fallback, source: "template", fingerprint };
}
