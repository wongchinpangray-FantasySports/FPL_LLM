import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";
import {
  isChineseLocale,
  lookupPlayerZh,
  PLAYER_ZH_OVERRIDES,
  resolveChinesePlayerNameMap,
} from "@/lib/wc/player-names-zh";

export type PlayerSearchFields = {
  web_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  second_name?: string | null;
  team?: string | null;
  total_points?: number | null;
};

/** Strip unsafe chars; keep CJK and Latin letters. */
export function sanitizePlayerQuery(q: string): string {
  return q
    .replace(/%/g, "")
    .replace(/[,*'"`;()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

export function containsCjk(text: string): boolean {
  return /\p{Script=Han}/u.test(text);
}

/** Accent-insensitive Latin normalization for matching. */
export function normalizeLatinSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated alias — same as normalizeLatinSearchText */
export const normalizeSearchText = normalizeLatinSearchText;

export function minPlayerQueryLength(q: string): number {
  return containsCjk(q.trim()) ? 1 : 2;
}

export function tokenizeLatinQuery(raw: string): string[] {
  const normalized = normalizeLatinSearchText(sanitizePlayerQuery(raw));
  if (!normalized) return [];
  return normalized.split(" ").filter((token) => token.length >= 2);
}

export function nameQueryTokens(raw: string | undefined): string[] {
  const sanitized = sanitizePlayerQuery(raw ?? "");
  if (!sanitized) return [];
  if (containsCjk(sanitized)) {
    const compact = sanitized.replace(/[\s·]/g, "");
    return compact.length >= 1 ? [compact] : [];
  }
  return tokenizeLatinQuery(sanitized);
}

function compactLatin(text: string): string {
  return normalizeLatinSearchText(text).replace(/\s+/g, "");
}

function zhLabelsForRow(
  row: PlayerSearchFields,
  zhMap: Map<string, string> | undefined,
): string[] {
  if (!zhMap) return [];
  const labels = new Set<string>();
  for (const field of [
    row.name,
    row.web_name,
    row.first_name && row.second_name
      ? `${row.first_name} ${row.second_name}`
      : null,
  ]) {
    const zh = lookupPlayerZh(zhMap, field ?? "");
    if (zh) labels.add(zh);
  }
  return [...labels];
}

export function englishKeysForZhQuery(
  query: string,
  zhMap: Map<string, string> = new Map(Object.entries(PLAYER_ZH_OVERRIDES)),
): string[] {
  const qNorm = query.replace(/[\s·]/g, "");
  if (!qNorm) return [];
  const keys: string[] = [];
  for (const [en, zh] of zhMap) {
    const zhNorm = zh.replace(/[\s·]/g, "");
    if (zhNorm.includes(qNorm) || zh.includes(query.trim())) {
      keys.push(en);
    }
  }
  return keys;
}

function latinTokenMatches(hayLatin: string, hayCompact: string, token: string): boolean {
  if (hayLatin.includes(token)) return true;
  if (hayCompact.includes(token)) return true;
  const words = hayLatin.split(" ").filter(Boolean);
  if (words.some((word) => word.startsWith(token))) return true;
  return false;
}

/** Higher = better match. 0 = no match. */
export function scorePlayerSearchMatch(
  row: PlayerSearchFields,
  rawQuery: string,
  opts?: { locale?: string; zhMap?: Map<string, string> },
): number {
  const query = sanitizePlayerQuery(rawQuery);
  if (!query || query.length < minPlayerQueryLength(query)) return 0;

  const zhMap =
    opts?.zhMap ??
    (isChineseLocale(opts?.locale ?? "") && containsCjk(query)
      ? new Map(Object.entries(PLAYER_ZH_OVERRIDES))
      : undefined);

  const zhLabels = zhLabelsForRow(row, zhMap);
  const fields = [
    row.web_name,
    row.name,
    row.first_name,
    row.second_name,
    row.team,
    row.first_name && row.second_name
      ? `${row.first_name} ${row.second_name}`
      : null,
    ...zhLabels,
  ].filter(Boolean) as string[];

  const hayLatin = normalizeLatinSearchText(fields.join(" "));
  const hayCompact = compactLatin(fields.join(" "));
  const hayCjk = fields.map((f) => f.replace(/[\s·]/g, "")).join("");

  let score = 0;

  if (containsCjk(query)) {
    const qCjk = query.replace(/[\s·]/g, "");
    if (hayCjk.includes(qCjk)) {
      score = 900 - hayCjk.indexOf(qCjk);
    } else if (zhMap) {
      for (const enKey of englishKeysForZhQuery(query, zhMap)) {
        const enTokens = tokenizeLatinQuery(enKey);
        if (
          enTokens.length > 0 &&
          enTokens.every((t) => latinTokenMatches(hayLatin, hayCompact, t))
        ) {
          score = Math.max(score, 750);
        }
      }
    }
    if (!score) return 0;
  } else {
    const tokens = tokenizeLatinQuery(query);
    if (!tokens.length) return 0;

    for (const token of tokens) {
      if (!latinTokenMatches(hayLatin, hayCompact, token)) return 0;
      score += 100;
      if (` ${hayLatin} `.includes(` ${token} `)) score += 40;
      if (hayCompact.startsWith(token)) score += 20;
    }

    const webNorm = normalizeLatinSearchText(row.web_name ?? "");
    if (webNorm && tokens.length === 1 && webNorm.startsWith(tokens[0]!)) {
      score += 120;
    }
    if (webNorm && tokens.join(" ") === webNorm) score += 200;
  }

  return score + Math.min((row.total_points ?? 0) / 100, 50);
}

export function playerMatchesQuery(
  row: PlayerSearchFields,
  rawQuery: string,
  opts?: { locale?: string; zhMap?: Map<string, string> },
): boolean {
  return scorePlayerSearchMatch(row, rawQuery, opts) > 0;
}

export function rankPlayerSearchResults<T extends PlayerSearchFields>(
  rows: T[],
  rawQuery: string,
  opts?: { locale?: string; zhMap?: Map<string, string>; limit?: number },
): T[] {
  const limit = opts?.limit ?? 20;
  return rows
    .map((row) => ({
      row,
      score: scorePlayerSearchMatch(row, rawQuery, opts),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.row.total_points ?? 0) - (a.row.total_points ?? 0);
    })
    .slice(0, limit)
    .map((entry) => entry.row);
}

const loadFplPlayerZhSearchMapCached = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const supa = getServerSupabase();
    const { data } = await supa
      .from("players_static")
      .select("name, web_name, first_name, second_name");
    const names = new Set<string>();
    for (const row of data ?? []) {
      if (row.name) names.add(String(row.name));
      if (row.web_name) names.add(String(row.web_name));
      const full = `${row.first_name ?? ""} ${row.second_name ?? ""}`.trim();
      if (full) names.add(full);
    }
    const map = await resolveChinesePlayerNameMap([...names]);
    return Object.fromEntries(map);
  },
  ["fpl-player-zh-search-map-v1"],
  { revalidate: 7 * 24 * 60 * 60 },
);

export async function loadFplPlayerZhSearchMap(): Promise<Map<string, string>> {
  const cached = await loadFplPlayerZhSearchMapCached();
  return new Map(Object.entries({ ...PLAYER_ZH_OVERRIDES, ...cached }));
}

export async function loadWcPlayerZhSearchMap(): Promise<Map<string, string>> {
  return resolveChinesePlayerNameMap();
}

export function wcPlayerSearchFields(row: {
  name?: string | null;
}): PlayerSearchFields {
  return {
    name: row.name,
    web_name: row.name,
    total_points: null,
  };
}

export { isChineseLocale } from "@/lib/wc/player-names-zh";
