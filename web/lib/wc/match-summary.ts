import { getServerSupabase } from "@/lib/supabase";
import { DEFAULT_MODEL, getGenAI } from "@/lib/llm";
import {
  buildMatchEnrichment,
  formatEnrichmentFacts,
  formatMatchTimeline,
  MATCH_ENRICHMENT_VERSION,
  type MatchEnrichment,
} from "@/lib/wc/match-enrichment";
import {
  buildWcMatchSchedule,
  isWcMatchFinished,
  type WcMatchGoal,
  type WcMatchRow,
} from "@/lib/wc/fifa-rounds";

export type MatchSummaryResult = {
  summary: string;
  source: "cache" | "gemini" | "template";
};

function normalizeLocale(locale: string): "en" | "zh" {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function matchSummaryFingerprint(
  match: WcMatchRow,
  enrichment?: MatchEnrichment,
): string {
  const goals = [...(match.home_goals ?? []), ...(match.away_goals ?? [])]
    .map(
      (g) =>
        `${g.minute ?? ""}:${g.scorer}:${g.assist ?? ""}:${g.fifa_player_id ?? ""}`,
    )
    .join("|");
  const cards = [...(match.home_cards ?? []), ...(match.away_cards ?? [])]
    .map((c) => `${c.minute ?? ""}:${c.player}:${c.card}`)
    .join("|");
  return [
    MATCH_ENRICHMENT_VERSION,
    match.status,
    match.home_score ?? "",
    match.away_score ?? "",
    match.home_penalty_score ?? "",
    match.away_penalty_score ?? "",
    goals,
    cards,
    enrichment?.fingerprintExtra ?? "",
  ].join(":");
}

function formatGoalLine(g: WcMatchGoal, assistWord: string): string {
  const min = g.minute ? `${g.minute}' ` : "";
  if (g.assist_display) {
    return `${min}${g.scorer_display} (${assistWord}: ${g.assist_display})`;
  }
  return `${min}${g.scorer_display}`;
}

function buildFactsBlock(
  match: WcMatchRow,
  enrichment: MatchEnrichment,
): string {
  const timeline = formatMatchTimeline(match);
  const lines: string[] = [];

  if (timeline) {
    lines.push("Match timeline (goals and cards, newest first):", timeline, "");
  }

  lines.push(
    `Round: ${match.round_label}`,
    `Venue: ${match.venue ?? "TBC"}${match.venue_city ? `, ${match.venue_city}` : ""}`,
    `Kickoff: ${match.kickoff ?? "TBC"}`,
    `Status: ${match.status}`,
    `Score: ${match.home_name} ${match.home_score ?? 0} - ${match.away_score ?? 0} ${match.away_name}`,
  );

  const homeGoals = match.home_goals ?? [];
  const awayGoals = match.away_goals ?? [];
  if (homeGoals.length) {
    lines.push(
      `${match.home_name} goals: ${homeGoals.map((g) => formatGoalLine(g, "assist")).join("; ")}`,
    );
  }
  if (awayGoals.length) {
    lines.push(
      `${match.away_name} goals: ${awayGoals.map((g) => formatGoalLine(g, "assist")).join("; ")}`,
    );
  }

  const homeCards = match.home_cards ?? [];
  const awayCards = match.away_cards ?? [];
  if (homeCards.length || awayCards.length) {
    const cardLines: string[] = [];
    for (const c of homeCards) {
      const min = c.minute ? `${c.minute}' ` : "";
      cardLines.push(
        `${min}${c.player_display} ${c.card} card (${match.home_name})`,
      );
    }
    for (const c of awayCards) {
      const min = c.minute ? `${c.minute}' ` : "";
      cardLines.push(
        `${min}${c.player_display} ${c.card} card (${match.away_name})`,
      );
    }
    lines.push(`Cards: ${cardLines.join("; ")}`);
  }

  lines.push("", "Additional context:", formatEnrichmentFacts(match, enrichment));
  return lines.join("\n");
}

function templateSummary(match: WcMatchRow, locale: "en" | "zh"): string {
  const home = match.home_name;
  const away = match.away_name;
  const hs = match.home_score ?? 0;
  const as = match.away_score ?? 0;
  const venue = match.venue ? ` at ${match.venue}` : "";

  if (locale === "zh") {
    let outcome: string;
    if (hs > as) outcome = `${home} 以 ${hs}-${as} 战胜 ${away}`;
    else if (as > hs) outcome = `${away} 以 ${as}-${hs} 战胜 ${home}`;
    else outcome = `${home} 与 ${away} ${hs}-${as} 战平`;

    const parts: string[] = [
      `${match.round_label}，${outcome}${venue ? `（${match.venue}）` : ""}。`,
    ];
    const goalBits: string[] = [];
    for (const g of match.home_goals ?? []) {
      goalBits.push(
        g.assist_display
          ? `${home} 的 ${g.scorer_display} 进球，${g.assist_display} 助攻`
          : `${home} 的 ${g.scorer_display} 进球`,
      );
    }
    for (const g of match.away_goals ?? []) {
      goalBits.push(
        g.assist_display
          ? `${away} 的 ${g.scorer_display} 进球，${g.assist_display} 助攻`
          : `${away} 的 ${g.scorer_display} 进球`,
      );
    }
    if (goalBits.length) parts.push(goalBits.join("；") + "。");
    return parts.join("");
  }

  let outcome: string;
  if (hs > as) outcome = `${home} beat ${away} ${hs}-${as}`;
  else if (as > hs) outcome = `${away} beat ${home} ${as}-${hs}`;
  else outcome = `${home} and ${away} drew ${hs}-${as}`;

  const parts: string[] = [
    `In ${match.round_label}, ${outcome}${venue}.`,
  ];
  const goalBits: string[] = [];
  for (const g of match.home_goals ?? []) {
    goalBits.push(
      g.assist_display
        ? `${g.scorer_display} for ${home} (assist: ${g.assist_display})`
        : `${g.scorer_display} for ${home}`,
    );
  }
  for (const g of match.away_goals ?? []) {
    goalBits.push(
      g.assist_display
        ? `${g.scorer_display} for ${away} (assist: ${g.assist_display})`
        : `${g.scorer_display} for ${away}`,
    );
  }
  if (goalBits.length) {
    parts.push(`Goals: ${goalBits.join("; ")}.`);
  }
  return parts.join(" ");
}

async function loadCachedSummary(
  matchId: number,
  locale: "en" | "zh",
  fingerprint: string,
): Promise<string | null> {
  try {
    const supa = getServerSupabase();
    const { data, error } = await supa
      .from("wc_match_stats")
      .select("summary_json, summary_fingerprint")
      .eq("fifa_tournament_id", matchId)
      .maybeSingle();
    if (error || !data) return null;
    if (data.summary_fingerprint !== fingerprint) return null;
    const json = data.summary_json as Record<string, string> | null;
    const hit = json?.[locale]?.trim();
    return hit || null;
  } catch {
    return null;
  }
}

async function saveCachedSummary(
  match: WcMatchRow,
  locale: "en" | "zh",
  summary: string,
  fingerprint: string,
): Promise<void> {
  try {
    const supa = getServerSupabase();
    const { data: existing } = await supa
      .from("wc_match_stats")
      .select("summary_json")
      .eq("fifa_tournament_id", match.id)
      .maybeSingle();

    const prev =
      (existing?.summary_json as Record<string, string> | null) ?? {};
    const summary_json = { ...prev, [locale]: summary };

    await supa.from("wc_match_stats").upsert(
      {
        fifa_tournament_id: match.id,
        round_id: match.round_id,
        kickoff: match.kickoff,
        venue: match.venue,
        venue_city: match.venue_city,
        status: match.status,
        period: match.period,
        minutes: match.minutes,
        extra_minutes: match.extra_minutes,
        home_code: match.home_code,
        away_code: match.away_code,
        home_name: match.home_name,
        away_name: match.away_name,
        home_score: match.home_score,
        away_score: match.away_score,
        home_scorers: match.home_scorers,
        away_scorers: match.away_scorers,
        summary_json,
        summary_fingerprint: fingerprint,
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
  enrichment: MatchEnrichment,
  locale: "en" | "zh",
): Promise<string | null> {
  try {
    const ai = await getGenAI();
    const langRule =
      locale === "zh"
        ? "Write in 中文. Use a clear, engaging broadcast tone."
        : "Write in English. Use a clear, engaging broadcast tone.";

    const prompt = `Write a World Cup match summary (2–3 short paragraphs, under 180 words total).
Use ONLY these facts — do not invent players, scores, minutes, or events:

${buildFactsBlock(match, enrichment)}

${langRule}
Open with the result and stage context. Lead with the goal and card timeline when minutes are listed.
Cover key goal scorers and assists (mention club/position when provided).
Include one paragraph on group standings or knockout implications when context is given.
If a team had prior results listed, weave that form into the narrative.
No bullet points. Plain prose only.`;

    const resp = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { temperature: 0.5 },
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

export async function getOrCreateMatchSummary(
  match: WcMatchRow,
  localeInput: string,
  allMatches?: WcMatchRow[],
): Promise<MatchSummaryResult> {
  const locale = normalizeLocale(localeInput);
  const schedule: WcMatchRow[] =
    allMatches ?? (await buildWcMatchSchedule()).matches;
  const enrichment = await buildMatchEnrichment(match, schedule);
  const fingerprint = matchSummaryFingerprint(match, enrichment);

  const cached = await loadCachedSummary(match.id, locale, fingerprint);
  if (cached) {
    return { summary: cached, source: "cache" };
  }

  const gemini = await generateWithGemini(match, enrichment, locale);
  if (gemini) {
    await saveCachedSummary(match, locale, gemini, fingerprint);
    return { summary: gemini, source: "gemini" };
  }

  const template = templateSummary(match, locale);
  await saveCachedSummary(match, locale, template, fingerprint);
  return { summary: template, source: "template" };
}

export function canSummarizeMatch(match: WcMatchRow): boolean {
  return isWcMatchFinished(match);
}
