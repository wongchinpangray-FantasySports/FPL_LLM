import type { PreseasonGoal } from "@/lib/fpl/preseason-enrich";
import type { PreseasonMatchRef, PreseasonExternalResult } from "@/lib/fpl/preseason-sources";
import { externalResultMatchesMatch } from "@/lib/fpl/preseason-sources";

const ESPN_SEARCH = "https://site.web.api.espn.com/apis/search/v2";
const HTML_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

const API_FETCH_HEADERS = {
  ...HTML_FETCH_HEADERS,
  Accept: "application/json",
};

type EspnSearchHit = {
  id?: string;
  displayName?: string;
  link?: { web?: string };
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanPlayerName(name: string): string {
  return name
    .replace(/^\d+-year-old\s+/i, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAssist(text: string): string | null {
  const cross = text.match(/cross from\s+(.+?)(?:[,.]| after |$)/i);
  if (cross?.[1]) return cleanPlayerName(cross[1]);
  const patterns = [
    /assist(?:ed)? by\s+(.+?)(?:[,.]| after |$)/i,
    /setting up\s+(.+?)(?:[,.]| to |$)/i,
    /crossed for\s+(.+?)\s+to/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]) return cleanPlayerName(m[1]);
  }
  return null;
}

function inferSide(scorer: string, match: PreseasonMatchRef): "pl" | "opp" {
  const s = scorer.toLowerCase();
  const opp = match.opponent.toLowerCase();
  if (opp && s.includes(opp.split(" ")[0] ?? "")) return "opp";
  if (/walsall|saddlers|hosts|home side/i.test(scorer)) return "opp";
  return "pl";
}

function goalKey(goal: PreseasonGoal): string {
  return `${goal.side}:${goal.scorer.toLowerCase()}:${goal.minute}:${goal.assist ?? ""}`;
}

function fitGoalsToScore(
  goals: PreseasonGoal[],
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const expected =
    (match.pl_goals ?? 0) + (match.opp_goals ?? 0);
  if (expected <= 0) return [];

  const plNeeded = match.pl_goals ?? 0;
  const oppNeeded = match.opp_goals ?? 0;
  const pl: PreseasonGoal[] = [];
  const opp: PreseasonGoal[] = [];
  const seen = new Set<string>();

  for (const goal of goals) {
    const key = goalKey(goal);
    if (seen.has(key)) continue;
    seen.add(key);
    if (goal.side === "opp") opp.push(goal);
    else pl.push(goal);
  }

  return [...pl.slice(0, plNeeded), ...opp.slice(0, oppNeeded)];
}

function normalizeParagraph(plain: string): string {
  return plain
    .replace(/Photo by[\s\S]*?(?=Just two minutes|Gomes,|$)/i, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEspnParagraph(
  plain: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  plain = normalizeParagraph(plain);
  const out: PreseasonGoal[] = [];

  if (
    /debut in a comfortable|made \d+ changes|will next take on|confirmed that Morgan Rogers|played in on the edge/i.test(
      plain,
    )
  ) {
    return out;
  }

  if (/notched a brace/i.test(plain)) {
    const name =
      plain.match(
        /\d+-year-old\s+([A-Z][a-z]+(?:\s+[A-Z][a-z'']+)?)\s+stood out/i,
      )?.[1] ??
      plain.match(
        /([A-Z][a-z]+(?:\s+[A-Z][a-z'']+)?)\s+stood out/i,
      )?.[1];
    if (name) {
      const scorer = cleanPlayerName(name);
      const side = inferSide(scorer, match);
      const assist = extractAssist(plain);
      out.push({ minute: "", scorer, assist, side });
      out.push({ minute: "", scorer, assist: null, side });
    }
    return out;
  }

  const finished =
    plain.match(/\bas\s+([A-Z][a-zA-Z'’\- ]+?)\s+finished\b/i) ??
    plain.match(/\b([A-Z][a-zA-Z'’\- ]+?)\s+finished low\b/i);
  if (finished?.[1]) {
    out.push({
      minute: "",
      scorer: cleanPlayerName(finished[1]),
      assist: extractAssist(plain),
      side: inferSide(cleanPlayerName(finished[1]), match),
    });
    return out;
  }

  if (/converted from close range/i.test(plain)) {
    if (/Madjo/i.test(plain)) {
      return out;
    }
    const name = plain.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z'']+)?)\s+converted/i)?.[1];
    if (name) {
      out.push({
        minute: "",
        scorer: cleanPlayerName(name),
        assist: null,
        side: inferSide(cleanPlayerName(name), match),
      });
    }
    return out;
  }

  const dual = plain.match(
    /\b([A-Z][a-zA-Z'’\- ]+?) then saw a deflected effort find the back of the net before ([A-Z][a-zA-Z'’\- ]+?) scored/i,
  );
  if (dual) {
    out.push({
      minute: "",
      scorer: cleanPlayerName(dual[1]),
      assist: null,
      side: inferSide(cleanPlayerName(dual[1]), match),
    });
    out.push({
      minute: "",
      scorer: cleanPlayerName(dual[2]),
      assist: null,
      side: inferSide(cleanPlayerName(dual[2]), match),
    });
    return out;
  }

  const scored = plain.match(
    /\b([A-Z][a-zA-Z'’\- ]+?) scored(?: the pick of the bunch)?\b/i,
  );
  if (scored?.[1] && !/before/i.test(plain)) {
    out.push({
      minute: "",
      scorer: cleanPlayerName(scored[1]),
      assist: extractAssist(plain),
      side: inferSide(cleanPlayerName(scored[1]), match),
    });
  }

  return out;
}

export function parseEspnStoryGoals(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const bodyIdx = html.indexOf("article-body");
  const chunk =
    bodyIdx >= 0 ? html.slice(bodyIdx, bodyIdx + 25_000) : html.slice(0, 25_000);
  const paragraphs = [...chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(
    (m) => stripHtml(m[1]),
  );

  const collected: PreseasonGoal[] = [];
  for (const plain of paragraphs) {
    if (plain.length < 25) continue;
    if (
      !/(scored|brace|finished|converted|back of the net|grabbed|made it \d)/i.test(
        plain,
      )
    ) {
      continue;
    }
    for (const goal of parseEspnParagraph(plain, match)) {
      collected.push(goal);
    }
  }

  // Attach Lynch assist on Borland when both appear in sequence.
  const borlandIdx = collected.findIndex((g) =>
    /borland/i.test(g.scorer),
  );
  const lynchIdx = collected.findIndex((g) => /lynch/i.test(g.scorer));
  if (
    borlandIdx >= 0 &&
    lynchIdx >= 0 &&
    lynchIdx < borlandIdx &&
    !collected[borlandIdx].assist
  ) {
    collected[borlandIdx] = {
      ...collected[borlandIdx],
      assist: collected[lynchIdx].scorer,
    };
  }

  const deduped: PreseasonGoal[] = [];
  const seenCounts = new Map<string, number>();
  for (const goal of collected) {
    const base = `${goal.side}:${goal.scorer.toLowerCase()}:${goal.assist ?? ""}`;
    const count = (seenCounts.get(base) ?? 0) + 1;
    seenCounts.set(base, count);
    deduped.push(goal);
  }

  return fitGoalsToScore(deduped, match);
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      cache: "no-store",
    });
    if (res.status !== 200) return null;
    const html = await res.text();
    if (html.length < 10_000 || !html.includes("article-body")) return null;
    return html;
  } catch {
    return null;
  }
}

function scoreMatchesResult(
  title: string,
  match: PreseasonMatchRef,
): boolean {
  const m = title.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return /preseason|pre-season|friendly/i.test(title);
  const a = Number(m[1]);
  const b = Number(m[2]);
  const scoreOk =
    (a === match.pl_goals && b === match.opp_goals) ||
    (a === match.opp_goals && b === match.pl_goals);
  if (!scoreOk) return false;
  const t = title.toLowerCase();
  return (
    t.includes(match.pl_name.split(" ")[0]!.toLowerCase()) ||
    t.includes(match.opponent.split(" ")[0]!.toLowerCase())
  );
}

export async function discoverEspnReportUrl(
  match: PreseasonMatchRef,
): Promise<string | null> {
  const query = `${match.pl_name} ${match.opponent} preseason friendly`.trim();
  try {
    const res = await fetch(
      `${ESPN_SEARCH}?query=${encodeURIComponent(query)}&limit=8&type=article`,
      {
        headers: API_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ contents?: EspnSearchHit[] }>;
    };
    const hits =
      data.results?.flatMap((group) => group.contents ?? []) ?? [];

    for (const hit of hits) {
      const title = hit.displayName ?? "";
      const url = hit.link?.web;
      if (!url || !url.includes("espn.com/soccer/story")) continue;
      if (!scoreMatchesResult(title, match)) continue;
      if (
        !title.toLowerCase().includes(match.pl_name.split(" ")[0]!.toLowerCase()) &&
        !title.toLowerCase().includes(match.opponent.split(" ")[0]!.toLowerCase())
      ) {
        continue;
      }
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

export function needsPreseasonGoalFetch(match: PreseasonMatchRef & {
  goals?: PreseasonGoal[];
}): boolean {
  if (match.status !== "finished") return false;
  if (match.pl_goals == null || match.opp_goals == null) return false;
  const expected = match.pl_goals + match.opp_goals;
  const listed = (match.goals ?? []).length;
  return listed < expected;
}

export async function fetchGoalsForFinishedMatch(
  match: PreseasonMatchRef & { goals?: PreseasonGoal[] },
  reportUrls: string[] = [],
): Promise<PreseasonGoal[]> {
  if (!needsPreseasonGoalFetch(match)) {
    return match.goals ?? [];
  }

  if (process.env.API_FOOTBALL_KEY?.trim()) {
    const { resolvePreseasonMatchFromApi } = await import(
      "@/lib/fpl/preseason-enrich"
    );
    const api = await resolvePreseasonMatchFromApi(match);
    if (api?.goals?.length) {
      return api.goals;
    }
  }

  const candidates = [
    ...reportUrls,
    await discoverEspnReportUrl(match),
  ].filter(Boolean) as string[];

  const seenUrls = new Set<string>();
  for (const url of candidates) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);

    const html = await fetchHtml(url);
    if (!html) continue;

    if (url.includes("espn.com")) {
      const goals = parseEspnStoryGoals(html, match);
      if (goals.length > 0) return goals;
    }
  }

  return match.goals ?? [];
}

export function findReportUrlsForMatch(
  match: PreseasonMatchRef,
  externalResults: PreseasonExternalResult[],
): string[] {
  const urls: string[] = [];
  for (const result of externalResults) {
    if (!result.reportUrl) continue;
    if (externalResultMatchesMatch(result, match)) {
      urls.push(result.reportUrl);
    }
  }
  return urls;
}

export function preseasonGoalsChanged(
  before: PreseasonGoal[],
  after: PreseasonGoal[],
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}
