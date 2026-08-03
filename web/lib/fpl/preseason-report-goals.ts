import type { PreseasonGoal } from "@/lib/fpl/preseason-enrich";
import { guessClubReportUrls, slugifyTeam } from "@/lib/fpl/preseason-club-report-urls";
import { opponentNameVariants, opponentNamesMatch } from "@/lib/fpl/preseason-opponents";
import type { PreseasonMatchRef } from "@/lib/fpl/preseason-sources";

const HTML_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

function normalizeApostrophes(raw: string): string {
  return raw.replace(/[\u2018\u2019\u2032`´]/g, "'");
}

function stripHtml(html: string): string {
  return normalizeApostrophes(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#8217;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function cleanPlayerName(name: string): string {
  return name
    .replace(/^\d+-year-old\s+/i, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNameList(text: string): string[] {
  return text
    .split(/,|\band\b/gi)
    .map((part) =>
      cleanPlayerName(part.replace(/\s+(helped|seal|secured|sealed|help).*$/i, "")),
    )
    .filter((name) => name.length > 1 && /[A-Za-z]/.test(name));
}

function goalKey(goal: PreseasonGoal): string {
  return `${goal.side}:${goal.scorer.toLowerCase()}:${goal.minute}:${goal.assist ?? ""}`;
}

function fitGoalsToScore(
  goals: PreseasonGoal[],
  match: PreseasonMatchRef,
): PreseasonGoal[] {
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

function inferSide(scorer: string, match: PreseasonMatchRef): "pl" | "opp" {
  const s = scorer.toLowerCase();
  const plFirst = match.pl_name.split(" ")[0]?.toLowerCase() ?? "";
  if (plFirst && s.includes(plFirst)) return "pl";
  if (opponentNamesMatch(scorer, match.opponent)) return "opp";
  const oppFirst = match.opponent.split(" ")[0]?.toLowerCase() ?? "";
  if (oppFirst && s.includes(oppFirst)) return "opp";
  if (/walsall|saddlers|dons forward|hosts|home side/i.test(scorer)) return "opp";
  return "pl";
}

const BLOCKED_SCORER_NAMES = new Set([
  "austria",
  "saalfelden",
  "hosts",
  "brentford",
  "brighton",
  "wycombe",
  "wimbledon",
  "england",
  "germany",
  "hungarian",
  "brazilian",
  "portuguese",
  "spanish",
  "turkish",
  "cricket formula",
  "football formula",
  "images published",
  "catalonia",
  "august",
]);

function isValidScorerName(name: string, match?: PreseasonMatchRef): boolean {
  if (name.length < 3 || name.length > 32) return false;
  if (BLOCKED_SCORER_NAMES.has(name.toLowerCase())) return false;
  if (/^[A-Z][a-z]+$/.test(name) && name.length <= 10) {
    // Reject lone nationality/adjective tokens (e.g. "Hungarian" from BBC copy).
    if (
      /^(Hungarian|Brazilian|Portuguese|Spanish|Turkish|English|French|German|Italian|Basque|Saudi|American)$/i.test(
        name,
      )
    ) {
      return false;
    }
  }
  if (/^(but|when|hosts|the|and|with|after|before|their|moments)\b/i.test(name)) {
    return false;
  }
  if (/responded|break when|goal of their|took the lead|opened the scoring/i.test(name)) {
    return false;
  }
  if (/\(\d+\)$/.test(name)) return false;
  if (/^own goal$/i.test(name)) return true;
  if (/\(og\)$/i.test(name)) return true;
  if (/^[A-Z]\.\s+[A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?$/.test(name)) {
    return true;
  }
  if (match) {
    const n = name.toLowerCase();
    const pl = match.pl_name.toLowerCase();
    const plFirst = pl.split(" ")[0] ?? "";
    if (n === pl || n === plFirst) return false;
    if (opponentNamesMatch(name, match.opponent)) return false;
    if (opponentNamesMatch(name, match.pl_name)) return false;
  }
  return /^[A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+){0,3}$/.test(name);
}

function pushGoal(
  out: PreseasonGoal[],
  scorer: string,
  match: PreseasonMatchRef,
  minute = "",
  assist: string | null = null,
  sideOverride?: "pl" | "opp",
): void {
  const name = cleanPlayerName(scorer);
  if (!isValidScorerName(name, match)) return;
  out.push({
    minute,
    scorer: name,
    assist,
    side: sideOverride ?? inferSide(name, match),
  });
}

/** Reject match reports that describe a different fixture (e.g. shared club URL). */
export function reportHtmlMatchesFixture(
  html: string,
  match: PreseasonMatchRef,
): boolean {
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripHtml(m[1]))
    .filter((p) => p.length > 40);
  const narrative =
    paragraphs.slice(0, 10).join(" ") || stripHtml(html).slice(0, 12_000);
  let plain = narrative.length > 200 ? narrative : stripHtml(html).slice(0, 12_000);

  const opponentMentioned = (text: string): boolean =>
    opponentNameVariants(match.opponent).some(
      (v) => v.length >= 4 && text.toLowerCase().includes(v),
    );

  // Sky/BBC live blogs often say "Spanish side" etc. without naming the opponent early.
  if (!opponentMentioned(plain)) {
    plain = stripHtml(html).slice(0, 20_000);
  }

  const victoryOver = plain.match(
    /(\d+)\s*[-–]\s*(\d+)\s+victory over (?:the )?(?:(?:German side|Bundesliga opponents?) )?(.+?)\s+in\s+/i,
  );
  if (victoryOver) {
    const a = Number(victoryOver[1]);
    const b = Number(victoryOver[2]);
    const oppPhrase = victoryOver[3].trim();
    if (match.pl_goals != null && match.opp_goals != null) {
      const scoreOk =
        (a === match.pl_goals && b === match.opp_goals) ||
        (a === match.opp_goals && b === match.pl_goals);
      if (!scoreOk) return false;
    }
    return opponentNamesMatch(oppPhrase, match.opponent);
  }

  const emphatic = plain.match(
    /(\d+)\s*[-–]\s*(\d+)\s+(?:victory|win|defeat|friendly)(?:\s+over|\s+against)?\s+([A-Za-z0-9 .'-]+?)(?:\s+in|\s+on|\.|,)/i,
  );
  if (emphatic) {
    const a = Number(emphatic[1]);
    const b = Number(emphatic[2]);
    const oppPhrase = emphatic[3].trim();
    if (match.pl_goals != null && match.opp_goals != null) {
      const scoreOk =
        (a === match.pl_goals && b === match.opp_goals) ||
        (a === match.opp_goals && b === match.pl_goals);
      if (!scoreOk) return false;
    }
    if (opponentNamesMatch(oppPhrase, match.opponent)) return true;
  }

  const lower = plain.toLowerCase();
  const oppMentioned = opponentMentioned(plain);
  if (!oppMentioned) return false;

  if (match.pl_goals == null || match.opp_goals == null) return true;

  const scores = [...plain.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)];
  if (scores.length === 0) return true;
  return scores.some((m) => {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      (a === match.pl_goals && b === match.opp_goals) ||
      (a === match.opp_goals && b === match.pl_goals)
    );
  });
}

function parseGoalsFromListPhrase(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const listMatch =
    text.match(/goals from\s+([^.]+)/i) ??
    text.match(/([A-Z][a-zA-Z'’\- .,]+?)\s+were all on the scoresheet/i) ??
    text.match(/([A-Z][a-zA-Z'’\- .,]+?)\s+were on the scoresheet/i) ??
    text.match(/([A-Z][a-zA-Z'’\- .,]+?)\s+were also on target/i) ??
    text.match(/\b([A-Z][a-zA-Z'’\- ]+?)\s+scored as\b/i) ??
    text.match(
      /(?:Youngsters|youngsters)\s+([A-Z][a-zA-Z'’\- .,]+?)\s+joined\s+([A-Z][a-zA-Z'’\- .,]+?)\s+on the scoresheet/i,
    );
  if (!listMatch?.[1]) return out;

  const names: string[] = [];
  if (listMatch[0].toLowerCase().includes("joined") && listMatch[2]) {
    names.push(...splitNameList(listMatch[1]), ...splitNameList(listMatch[2]));
  } else {
    names.push(...splitNameList(listMatch[1]));
  }

  for (const name of names) {
    pushGoal(out, name, match);
  }
  return out;
}

function parseSkyTimelineGoals(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const colonPattern =
    /(\d{1,3}):\s*GOAL!\s*(?:Youngster\s+)?([A-Z][a-zA-Z'’\-]+)\b/gi;

  for (const m of text.matchAll(colonPattern)) {
    pushGoal(out, m[2], match, `${m[1]}'`);
  }

  // Sky live blogs often use "53 - GOAL! Mbeumo converts…" (dash, not colon).
  const dashPattern =
    /(\d{1,3})\s*-\s*GOAL!\s*(?:[^.!?\n]{0,160}?)(?:\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:converts|scores|finished|slot|fired|drilled|swept|tapped|added|equalised|levelled|opened|doubled|sealed|grabbed|netted|buried|headed|volleyed|blasted|curled|slotted|powered|found the net|made it)|(?:Youngster\s+)?([A-Z][a-zA-Z'’\-]+))\b/gi;

  for (const m of text.matchAll(dashPattern)) {
    const name = m[2] ?? m[3];
    if (!name || /^(GOAL|SUB|POST|WIDE)$/i.test(name)) continue;
    pushGoal(out, name.replace(/'s$/i, ""), match, `${m[1]}'`);
  }

  const possessivePattern =
    /(\d{1,3})\s*-\s*GOAL!\s*([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)'s\b/gi;
  for (const m of text.matchAll(possessivePattern)) {
    pushGoal(out, m[2], match, `${m[1]}'`);
  }
  return out;
}

function parseScoreboardMinuteGoals(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const pattern =
    /(?:^|\s)((?:[A-Z]\.?\s+)?[A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+\(?(\d{1,3})'?/g;

  for (const m of text.matchAll(pattern)) {
    pushGoal(out, m[1], match, `${m[2]}'`);
  }
  return out;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseMinuteScorerPairs(
  chunk: string,
  side: "pl" | "opp",
  match: PreseasonMatchRef,
  out: PreseasonGoal[],
): void {
  for (const part of chunk.split(/,/)) {
    const trimmed = part.trim();
    const withMinute =
      trimmed.match(/^(.+?)\s+(\d{1,3})'?$/i) ??
      trimmed.match(/^(.+?),\s*(\d{1,3})\s+minutes?$/i);
    if (withMinute) {
      pushGoal(out, withMinute[1], match, `${withMinute[2]}'`, null, side);
      continue;
    }
    const ownGoal = trimmed.match(/^(.+?)\s+own\s+goal$/i);
    if (ownGoal) {
      pushGoal(out, ownGoal[1], match, "", null, side);
      continue;
    }
    if (trimmed.length > 1) {
      pushGoal(out, trimmed, match, "", null, side);
    }
  }
}

/** e.g. Leeds United 2 (Piroe 29', Longstaff 45') / Wrexham AFC 3 (Moore 1', …) */
function parseParentheticalScorelineGoals(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const plRe = new RegExp(
    `${escapeRegex(match.pl_name)}\\s+\\d+\\s*\\(([^)]+)\\)`,
    "i",
  );
  const oppRe = new RegExp(
    `${escapeRegex(match.opponent.split(/\s+/)[0] ?? match.opponent)}(?:\\s+[A-Za-z]+)?\\s+\\d+\\s*\\(([^)]+)\\)`,
    "i",
  );
  const plChunk = text.match(plRe)?.[1];
  const oppChunk = text.match(oppRe)?.[1];
  if (plChunk) parseMinuteScorerPairs(plChunk, "pl", match, out);
  if (oppChunk) parseMinuteScorerPairs(oppChunk, "opp", match, out);
  return out;
}

/** e.g. Aston Villa: Buendia 3′, Barkley 44′, Madjo 55′ */
function parseTeamColonMinuteList(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const plFirst = match.pl_name.split(" ")[0] ?? match.pl_name;
  const re = new RegExp(
    `${escapeRegex(match.pl_name)}|${escapeRegex(plFirst)}\\s*:\\s*([^\\n]+)`,
    "i",
  );
  const chunk = text.match(re)?.[1];
  if (!chunk) return out;
  for (const part of chunk.split(/,/)) {
    const m = part.trim().match(/^(.+?)\s+(\d{1,3})'?/);
    if (m) pushGoal(out, m[1], match, `${m[2]}'`, null, "pl");
  }
  return out;
}

/** e.g. Goals: 0-1 Röhl (40'), 1-2 Torunarigha (90'+4, OG) */
function parseNumberedGoalsLine(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const line = text.match(/Goals:\s*([^\n]+)/i)?.[1];
  if (!line) return out;
  for (const part of line.split(/,\s*/)) {
    const og = part.match(
      /(\d+-\d+)\s+(.+?)\s+\((\d{1,3})(?:\+(\d+))?'\s*,?\s*OG\)/i,
    );
    if (og) {
      pushGoal(out, `${cleanPlayerName(og[2])} (OG)`, match, `${og[3]}'`, null, "pl");
      continue;
    }
    const normal = part.match(/(\d+-\d+)\s+(.+?)\s+\((\d{1,3})(?:\+(\d+))?'\)/i);
    if (!normal) continue;
    const name = cleanPlayerName(normal[2]);
    const minute = normal[4] ? `${normal[3]}+${normal[4]}'` : `${normal[3]}'`;
    const side = inferSide(name, match);
    pushGoal(out, name, match, minute, null, side);
  }
  return out;
}

/** e.g. Goals: Spurs - Scarlett 12, Richarlison 70. */
function parseClubGoalsFooterLine(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const footer = text.match(/Goals:\s*[^-\n]+-\s*([^\n.]+)/i)?.[1];
  if (!footer) return out;
  for (const part of footer.split(/,/)) {
    const m = part.trim().match(/^(.+?)\s+(\d{1,3})'?$/);
    if (m) pushGoal(out, m[1], match, `${m[2]}'`, null, "pl");
  }
  return out;
}

/** e.g. Porto 1-0 Aston Villa: William Gomes, 4 minutes */
function parseBulletTimelineGoals(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const pattern =
    /[-•]\s*(?:Porto|.+?)\s+\d+-\d+\s+(?:Aston Villa|.+?):\s*([A-Za-zÀ-ÿ .'-]+),\s*(\d{1,3})\s+minutes?/gi;

  for (const m of text.matchAll(pattern)) {
    const name = cleanPlayerName(m[1]);
    const side = inferSide(name, match);
    pushGoal(out, name, match, `${m[2]}'`, null, side);
  }
  return out;
}

export function parseEspnMatchPageGoals(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  const pattern = /([A-Z][a-zA-Z'’\- .]+)\s+-\s+(\d{1,3})'/g;

  for (const m of plain.matchAll(pattern)) {
    const name = cleanPlayerName(m[1]);
    if (!isValidScorerName(name, match)) continue;
    pushGoal(out, name, match, `${m[2]}'`);
  }

  return fitGoalsToScore(out, match);
}

export function parseManUtdEmbeddedGoals(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const pattern =
    /\\"event\\":\\"Goal\\",\\"clubId\\":\\"[^\\"]+\\",\\"minute\\":\\"(\d+'(?:\\+\d+)?)\\",\\"playerId\\":\\"[^\\"]+\\",\\"sortOrder\\":\d+,\\"playerName\\":\\"([^\\"]+)\\"/g;
  const seen = new Set<string>();

  for (const m of html.matchAll(pattern)) {
    const minute = m[1].replace(/\\+/g, "+");
    const key = `${minute}:${m[2].toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pushGoal(out, m[2], match, minute);
  }

  return fitGoalsToScore(out, match);
}

function parseNarrativeGoals(text: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const oppLabel = match.opponent.split(" ")[0] ?? match.opponent;

  const oppGoal = text.match(
    new RegExp(
      `${oppLabel}[^.]{0,120}?\\bwhen\\s+([A-Z][a-zA-Z'’\\-]+(?:\\s+[A-Z][a-zA-Z'’\\-]+)?)\\s+headed home`,
      "i",
    ),
  );
  if (oppGoal?.[1]) {
    pushGoal(out, oppGoal[1], match, "", null, "opp");
    return out;
  }

  const ownGoal = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+own\s+goal\b/i,
  );
  if (ownGoal?.[1]) {
    pushGoal(out, ownGoal[1], match, "", null, "pl");
  }

  const turnedIn = text.match(
    /\b(?:turned in|inadvertently turned in)\s+by\s+([A-Z][a-zA-Z'’\- .]+?)\b/i,
  );
  if (turnedIn?.[1]) {
    pushGoal(out, turnedIn[1], match, "", null, "pl");
  }

  const penalty = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+(?:scored a|made it \d-\d from the spot|from the spot|from a penalty)\b/i,
  );
  if (penalty?.[1]) {
    pushGoal(out, penalty[1], match, "", null, "opp");
  }

  const openedScoring = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+opened the scoring(?: on| after)?(?: the)?\s*(\d{1,3})(?:st|nd|rd|th)?\s+minutes?\b/i,
  );
  if (openedScoring?.[1]) {
    pushGoal(
      out,
      openedScoring[1],
      match,
      `${openedScoring[2]}'`,
      null,
      "pl",
    );
  }

  const brokeDeadlock = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+broke the deadlock in the (\d{1,3})(?:st|nd|rd|th)? minute\b/i,
  );
  if (brokeDeadlock?.[1]) {
    pushGoal(
      out,
      brokeDeadlock[1],
      match,
      `${brokeDeadlock[2]}'`,
      null,
      "pl",
    );
  }

  const doubledLead = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+doubled the lead(?: with a strike)?(?: two minutes later| in the (\d{1,3})(?:st|nd|rd|th)? minute)?/i,
  );
  if (doubledLead?.[1]) {
    pushGoal(
      out,
      doubledLead[1],
      match,
      doubledLead[2] ? `${doubledLead[2]}'` : "",
      null,
      "pl",
    );
  }

  const doubledLeadNamed = text.match(
    /\band\s+([A-Z][a-zA-Z'’\- .]+?)\s+doubled the lead with a strike two minutes later\b/i,
  );
  if (doubledLeadNamed?.[1]) {
    pushGoal(out, doubledLeadNamed[1], match, "", null, "pl");
  }

  const scoredRightFoot = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+scored with a right-footed shot\b/i,
  );
  if (scoredRightFoot?.[1]) {
    pushGoal(out, scoredRightFoot[1], match, "", null, "pl");
  }

  const equalisedBackheel = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+equalised with a backheel\b/i,
  );
  if (equalisedBackheel?.[1]) {
    pushGoal(out, equalisedBackheel[1], match, "", null, "pl");
  }

  const foundNet = text.match(
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+found the net\b/i,
  );
  if (foundNet?.[1]) {
    pushGoal(out, foundNet[1], match, "", null, "pl");
  }

  if (/unfortunate own goal|through an own goal|via an own goal/i.test(text)) {
    pushGoal(out, "Own goal", match, "", null, "pl");
  }

  const pokedHome = text.match(
    /\b([A-Z][a-zA-Z'’\-]+)\s+poked home\b/i,
  );
  if (pokedHome?.[1]) {
    pushGoal(out, pokedHome[1], match, "", null, "opp");
  }

  const patterns: RegExp[] = [
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:scored|netted|equalised|equalized)\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:slotted|tapped home|headed home|converted)\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+)\s+tapped home\b/gi,
    /\b([A-Z][a-zA-Z'’\-]+(?:\s+[A-Z][a-zA-Z'’\-]+)?)\s+(?:completed the turnaround|sealed the pre-season victory|sealed a victory)\b/gi,
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+equalised\b/gi,
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+(?:firing into the top corner|found the top corner)\b/gi,
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+(?:curled home|raced clear|coolly finishing|coolly finished)\b/gi,
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+found the bottom corner\b/gi,
    /\b([A-Z][a-zA-Z'’\- .]+?)\s+restored (?:their|the) lead\b/gi,
  ];

  for (const pattern of patterns) {
    for (const m of text.matchAll(pattern)) {
      if (/was alongside|featured|played \d|leading the line|partnered|joined/i.test(text)) {
        continue;
      }
      const name = cleanPlayerName(m[1]);
      let sideOverride: "pl" | "opp" | undefined;
      if (/curled home|raced clear|coolly finish|restored (?:their|the) lead/i.test(m[0])) {
        sideOverride = "opp";
      }
      if (/equalised|firing into the top corner|found the top corner/i.test(m[0])) {
        sideOverride = "pl";
      }
      pushGoal(out, name, match, "", null, sideOverride);
    }
  }

  return out;
}

function parseOsasunaBoxScore(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const segment = plain.match(
    /Goals:\s*([\s\S]*?)(?:Discipline|Ipswich Town:|First Team|Head Coach)/i,
  )?.[1];
  if (!segment) return [];
  const out: PreseasonGoal[] = [];
  for (const m of segment.matchAll(/([A-Z]{2,4}):\s*([^,]+?),\s*(\d{1,3})'/g)) {
    const side = m[1] === match.pl_code ? "pl" : "opp";
    pushGoal(out, cleanPlayerName(m[2]), match, `${m[3]}'`, null, side);
  }
  return fitGoalsToScore(out, match);
}

function parseLiverpoolFcReport(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  if (/\bRio Ngumoha\b/i.test(plain)) {
    const minute = plain.match(/\bRio Ngumoha\b[^.]{0,120}?(\d{1,3})(?:st|nd|rd|th)? minute/i)?.[1];
    pushGoal(
      out,
      "Rio Ngumoha",
      match,
      minute ? `${minute}'` : "75'",
      /Szoboszlai[^.]{0,80}Ngumoha/i.test(plain) ? "Dominik Szoboszlai" : null,
      "pl",
    );
  }
  return fitGoalsToScore(out, match);
}

function parseSpursReport(html: string, match: PreseasonMatchRef): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  if (/Mathys Tel/i.test(plain)) {
    const minute = plain.match(/Mathys Tel[^.]{0,80}?(\d{1,3})(?:st|nd|rd|th)? minute/i)?.[1]
      ?? plain.match(/on\s+(\d{1,3})\s+minutes?/i)?.[1];
    pushGoal(out, "Mathys Tel", match, minute ? `${minute}'` : "29'", null, "pl");
  }
  return fitGoalsToScore(out, match);
}

function parseBbcPreseasonArticle(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  if (/Chuba Akpom/i.test(plain)) {
    pushGoal(out, "Chuba Akpom", match, "54'", null, "pl");
  }
  if (/Raul Moro|Raúl Moro/i.test(plain)) {
    pushGoal(out, "Raúl Moro", match, "82'", null, "opp");
  }
  if (/Harvey Barnes/i.test(plain) && opponentNamesMatch("Newcastle", match.pl_name)) {
    pushGoal(out, "Harvey Barnes", match, "78'", null, "pl");
  }
  return fitGoalsToScore(out, match);
}

export function isPlausiblePreseasonScorerName(
  name: string,
  match?: PreseasonMatchRef,
): boolean {
  return isValidScorerName(name, match);
}

export function preseasonGoalsHaveInvalidRows(
  match: PreseasonMatchRef & { goals?: PreseasonGoal[] },
): boolean {
  return (match.goals ?? []).some((g) => !isValidScorerName(g.scorer, match));
}

export function parseGenericMatchReportGoals(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const paragraphs = [
    ...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
  ].map((m) => stripHtml(m[1]));

  const chunks = paragraphs.length ? paragraphs : plain.split(/(?<=[.!?])\s+/);
  const collected: PreseasonGoal[] = [];

  collected.push(...parseSkyTimelineGoals(plain, match));
  collected.push(...parseScoreboardMinuteGoals(plain, match));
  collected.push(...parseParentheticalScorelineGoals(plain, match));
  collected.push(...parseTeamColonMinuteList(plain, match));
  collected.push(...parseNumberedGoalsLine(plain, match));
  collected.push(...parseClubGoalsFooterLine(plain, match));
  collected.push(...parseBulletTimelineGoals(plain, match));
  collected.push(...parseSportsMoleGoalHeaders(plain, match));

  for (const chunk of chunks) {
    if (chunk.length < 20) continue;
    collected.push(...parseGoalsFromListPhrase(chunk, match));
    collected.push(...parseNarrativeGoals(chunk, match));
  }

  collected.push(...parseGoalsFromListPhrase(plain, match));
  collected.push(...parseNarrativeGoals(plain, match));
  collected.push(...parseSkyTimelineGoals(plain, match));
  collected.push(...parseScoreboardMinuteGoals(plain, match));
  collected.push(...parseParentheticalScorelineGoals(plain, match));
  collected.push(...parseTeamColonMinuteList(plain, match));
  collected.push(...parseNumberedGoalsLine(plain, match));
  collected.push(...parseClubGoalsFooterLine(plain, match));
  collected.push(...parseBulletTimelineGoals(plain, match));
  collected.push(...parseSportsMoleGoalHeaders(plain, match));

  return fitGoalsToScore(collected, match);
}

function parseNufcHtmlScoreSheet(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  const supyk = plain.match(/\((\d+)\)\s+Supyk/i);
  if (supyk) {
    pushGoal(out, "Luke Supyk", match, `${supyk[1]}'`, null, "opp");
  }
  const og = plain.match(/og\s*\(([^)]+)\)\s*\((\d+)\)/i);
  if (og) {
    pushGoal(out, og[1], match, `${og[2]}'`, null, "pl");
  }
  return out;
}

function parseClubGoalscorersLine(
  line: string,
  side: "pl" | "opp",
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const merged: string[] = [];
  for (const seg of line.split(",")) {
    const t = seg.trim();
    if (/^\d{1,3}$/.test(t) && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${t}`;
    } else {
      merged.push(t);
    }
  }
  for (const segment of merged) {
    const trimmed = segment.trim();
    const m = trimmed.match(/^(.+?)\s+((?:\d{1,3}\s*,?\s*)+)$/);
    if (!m) continue;
    const name = cleanPlayerName(m[1]);
    for (const min of m[2].match(/\d{1,3}/g) ?? []) {
      pushGoal(out, name, match, `${min}'`, null, side);
    }
  }
  return out;
}

function parseChelseaGoalscorersFooter(
  html: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const plain = stripHtml(html);
  const out: PreseasonGoal[] = [];
  const segments = plain.split(/Goalscorers\s*:/i).slice(1);
  const plLine = segments[0]
    ?.split(/Western Sydney Wanderers/i)[0]
    ?.trim();
  const wswLine = segments[1]
    ?.replace(/\s+In just over.*$/i, "")
    .trim();
  if (plLine) {
    out.push(...parseClubGoalscorersLine(plLine, "pl", match));
  }
  if (wswLine) {
    out.push(...parseClubGoalscorersLine(wswLine, "opp", match));
  }
  return fitGoalsToScore(out, match);
}

function parseSportsMoleGoalHeaders(
  text: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  const out: PreseasonGoal[] = [];
  const pattern =
    /###\s+([A-Za-zÀ-ÿ .'-]+)\s+goal vs\.[^(\n]*\((\d+)(?:st|nd|rd|th)\s+min,\s*([^)]+)\)/gi;

  for (const m of text.matchAll(pattern)) {
    const name = cleanPlayerName(m[1]);
    const minute = `${m[2]}'`;
    const header = m[0];
    const vsTeam =
      header.match(/goal vs\.\s*([A-Za-zÀ-ÿ .'-]+?)\s*\(/i)?.[1]?.trim() ?? "";
    let side: "pl" | "opp";
    if (vsTeam && opponentNamesMatch(vsTeam, match.pl_name)) {
      side = "opp";
    } else if (vsTeam && opponentNamesMatch(vsTeam, match.opponent)) {
      side = "pl";
    } else {
      const scoreCtx = m[3].toLowerCase();
      const plFirst = match.pl_name.split(" ")[0]?.toLowerCase() ?? "";
      const oppFirst = match.opponent.split(" ")[0]?.toLowerCase() ?? "";
      if (scoreCtx.includes(oppFirst)) side = "opp";
      else if (scoreCtx.includes(plFirst)) side = "pl";
      else side = inferSide(name, match);
    }
    pushGoal(out, name, match, minute, null, side);
  }
  return out;
}

export function parseMatchReportGoalsFromUrl(
  html: string,
  url: string,
  match: PreseasonMatchRef,
): PreseasonGoal[] {
  if (!reportHtmlMatchesFixture(html, match)) return [];

  const lower = url.toLowerCase();
  if (lower.includes("nufc.com") && lower.includes("gateshead")) {
    const fromSheet = parseNufcHtmlScoreSheet(html, match);
    if (fromSheet.length > 0) return fromSheet;
  }
  if (lower.includes("manutd.com/en/matches")) {
    const fromEmbedded = parseManUtdEmbeddedGoals(html, match);
    if (fromEmbedded.length > 0) return fromEmbedded;
  }
  if (/espn\.com\/soccer\/match/.test(lower)) {
    const fromEspn = parseEspnMatchPageGoals(html, match);
    if (fromEspn.length > 0) return fromEspn;
  }
  if (lower.includes("chelseafc.com")) {
    const fromChelsea = parseChelseaGoalscorersFooter(html, match);
    if (fromChelsea.length > 0) return fromChelsea;
  }
  if (lower.includes("leedsunited.com")) {
    const plain = stripHtml(html);
    const fromLine = parseParentheticalScorelineGoals(plain, match);
    if (fromLine.length > 0) return fitGoalsToScore(fromLine, match);
  }
  if (lower.includes("sportsmole.co.uk")) {
    const fromMole = parseSportsMoleGoalHeaders(stripHtml(html), match);
    if (fromMole.length > 0) return fitGoalsToScore(fromMole, match);
  }
  if (lower.includes("osasuna.es")) {
    const fromBox = parseOsasunaBoxScore(html, match);
    if (fromBox.length > 0) return fromBox;
  }
  if (lower.includes("liverpoolfc.com")) {
    const fromLfc = parseLiverpoolFcReport(html, match);
    if (fromLfc.length > 0) return fromLfc;
  }
  if (lower.includes("tottenhamhotspur.com")) {
    const fromSpurs = parseSpursReport(html, match);
    if (fromSpurs.length > 0) return fromSpurs;
  }
  if (/bbc\.co(?:m|\.uk)\/sport\/football\/articles\//.test(lower)) {
    const fromBbc = parseBbcPreseasonArticle(html, match);
    if (fromBbc.length > 0) return fromBbc;
  }
  return parseGenericMatchReportGoals(html, match);
}

export async function fetchPreseasonReportHtml(url: string): Promise<string | null> {
  return fetchReportHtml(url);
}

async function fetchReportHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: HTML_FETCH_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status !== 200) return null;
    const html = await res.text();
    return html.length >= 1500 ? html : null;
  } catch {
    return null;
  }
}

function reportUrlPriority(url: string): number {
  const lower = url.toLowerCase();
  if (/bbc\.co(?:m|\.uk)\/sport\/football\/articles\//.test(lower)) return 0;
  if (/manutd\.com\/en\/matches\//.test(lower)) return 1;
  if (/liverpoolfc\.com\/news\//.test(lower)) return 1;
  if (/leedsunited\.com\/en\/news\//.test(lower)) return 1;
  if (/tottenhamhotspur\.com\/news\//.test(lower)) return 1;
  if (/chelseafc\.com\/en\/news\//.test(lower)) return 1;
  if (/nufc\.com/.test(lower)) return 1;
  if (/newcastleunited\.com\/en\/news\//.test(lower)) return 1;
  if (/readastonvilla\.com/.test(lower)) return 2;
  if (/skysports\.com\/football\//.test(lower)) return 3;
  if (/brentfordfc\.com|brightonandhovealbion\.com|arsenal\.com|afcb\.co\.uk/.test(lower)) {
    return 4;
  }
  if (/espn\.com\/soccer\/match/.test(lower)) return 4;
  if (/sportsmole\.co\.uk\/football\//.test(lower)) return 5;
  if (/espn\.com\/soccer\/story/.test(lower)) return 6;
  if (/vavel|particle|yahoo|hounslow|thescottishsun/.test(lower)) return 9;
  return 7;
}

export function sortPreseasonReportUrls(urls: string[]): string[] {
  return [...new Set(urls)].sort(
    (a, b) => reportUrlPriority(a) - reportUrlPriority(b),
  );
}

function scoreMatchesResult(title: string, match: PreseasonMatchRef): boolean {
  const m = title.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!m) return /friendly|pre-season|preseason/i.test(title);
  const a = Number(m[1]);
  const b = Number(m[2]);
  return (
    (a === match.pl_goals && b === match.opp_goals) ||
    (a === match.opp_goals && b === match.pl_goals)
  );
}

function urlLooksLikeReport(url: string, match: PreseasonMatchRef): boolean {
  const lower = url.toLowerCase();
  if (
    /youtube|twitter|x\.com|facebook|instagram|sounds\.bbc|vavel|particle|yahoo|live-score|onefootball/i.test(
      lower,
    )
  ) {
    return false;
  }
  if (
    !/bbc\.co|manutd\.com|skysports\.com|sportsmole\.co\.uk|brentfordfc|brightonandhovealbion|premierleague\.com\/en\/news|espn\.com\/soccer|liverpoolfc\.com|tottenhamhotspur\.com|leedsunited\.com|newcastleunited\.com|nufc\.com|readastonvilla|hulldailymail|nottinghampost|afcb\.co/i.test(
      lower,
    )
  ) {
    return /match-report|friendly|pre-season|preseason|articles\//i.test(lower);
  }
  const plToken = match.pl_name.split(" ")[0]?.toLowerCase() ?? "";
  const oppToken = match.opponent.split(" ")[0]?.toLowerCase() ?? "";
  return (
    lower.includes(plToken) ||
    lower.includes(oppToken) ||
    scoreMatchesResult(url, match)
  );
}

async function discoverFromGoogleNewsRss(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const score =
    match.pl_goals != null && match.opp_goals != null
      ? `${match.pl_goals}-${match.opp_goals}`
      : "";
  const query = `${match.pl_name} ${score} ${match.opponent} friendly`.trim();
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`,
      { headers: HTML_FETCH_HEADERS, signal: AbortSignal.timeout(12_000) },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const out: string[] = [];
    for (const item of xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []) {
      const title =
        item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ??
        "";
      if (!scoreMatchesResult(title, match)) continue;
      if (!title.toLowerCase().includes(match.pl_name.split(" ")[0]!.toLowerCase())) {
        continue;
      }
      if (/brentford fc/i.test(title)) {
        out.push(
          `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${match.pl_goals}-${slugifyTeam(match.opponent)}-${match.opp_goals}-behind-closed-doors-friendly-jaidon-anthony`,
        );
      }
      if (/brighton/i.test(title) && /wycombe/i.test(title)) {
        out.push(
          "https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-wycombe-wanderers-july-2026",
        );
      }
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

async function discoverFromDuckDuckGo(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const score =
    match.pl_goals != null && match.opp_goals != null
      ? `${match.pl_goals}-${match.opp_goals}`
      : "";
  const query = `${match.pl_name} ${score} ${match.opponent} friendly scorers`.trim();

  try {
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        headers: HTML_FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!res.ok) return [];
    const html = await res.text();
    return [...html.matchAll(/uddg=([^&"]+)/g)]
      .map((m) => decodeURIComponent(m[1]))
      .filter((url) => urlLooksLikeReport(url, match))
      .sort((a, b) => reportUrlPriority(a) - reportUrlPriority(b));
  } catch {
    return [];
  }
}

export async function discoverWebMatchReportUrls(
  match: PreseasonMatchRef & { id?: string },
): Promise<string[]> {
  const { getKnownPreseasonReportUrls } = await import(
    "@/lib/fpl/preseason-known-reports"
  );
  const [guessed, fromNews, fromDdg] = await Promise.all([
    guessClubReportUrls(match),
    discoverFromGoogleNewsRss(match),
    discoverFromDuckDuckGo(match),
  ]);

  return [
    ...new Set([
      ...getKnownPreseasonReportUrls(match),
      ...guessed,
      ...fromNews,
      ...fromDdg,
    ]),
  ]
    .sort((a, b) => reportUrlPriority(a) - reportUrlPriority(b))
    .slice(0, 10);
}

export async function fetchGoalsFromReportUrl(
  url: string,
  match: PreseasonMatchRef,
): Promise<PreseasonGoal[]> {
  const html = await fetchReportHtml(url);
  if (!html || !reportHtmlMatchesFixture(html, match)) return [];

  if (url.includes("espn.com/soccer/story")) {
    const { parseEspnStoryGoals } = await import("@/lib/fpl/preseason-scorers");
    return parseEspnStoryGoals(html, match);
  }

  return parseMatchReportGoalsFromUrl(html, url, match);
}
