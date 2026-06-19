import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase";

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "FPL-LLM/1.0 (FALEAGUE AI World Cup; contact: faleague-ai.com)";
const CHUNK_SIZE = 35;

export function isChineseLocale(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

export function normPlayerNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeSparqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchChineseLabelsChunk(
  names: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (names.length === 0) return out;

  const inList = names
    .map((n) => `"${escapeSparqlString(normPlayerNameKey(n))}"`)
    .join(" ");

  const query = `
SELECT ?en ?zh WHERE {
  ?item wdt:P106 wd:Q937857 .
  ?item rdfs:label ?en .
  FILTER(LANG(?en) = "en")
  ?item rdfs:label ?zh .
  FILTER(LANG(?zh) IN ("zh", "zh-cn", "zh-hans"))
  FILTER(LCASE(STR(?en)) IN (${inList}))
}
LIMIT 500
`;

  const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/sparql-results+json",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return out;

    const json = (await res.json()) as {
      results?: {
        bindings?: {
          en?: { value?: string };
          zh?: { value?: string };
        }[];
      };
    };

    for (const row of json.results?.bindings ?? []) {
      const en = row.en?.value?.trim();
      const zh = row.zh?.value?.trim();
      if (en && zh) out.set(normPlayerNameKey(en), zh);
    }
  } catch {
    /* Wikidata unavailable — fall back to English names */
  }

  return out;
}

async function fetchChineseLabels(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const merged = new Map<string, string>();

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const partial = await fetchChineseLabelsChunk(chunk);
    for (const [k, v] of partial) merged.set(k, v);
  }

  return merged;
}

async function loadWcPoolEnglishNames(): Promise<string[]> {
  const supa = getServerSupabase();
  const { data } = await supa.from("wc_players").select("name");
  return [...new Set((data ?? []).map((r) => String(r.name ?? "").trim()).filter(Boolean))];
}

const loadCachedPoolChineseNames = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const names = await loadWcPoolEnglishNames();
    const map = await fetchChineseLabels(names);
    return Object.fromEntries(map);
  },
  ["wc-player-names-zh-pool-v1"],
  { revalidate: 86_400 },
);

/** English name → Chinese label (Simplified). Falls back to English when unknown. */
export async function resolveChinesePlayerNameMap(
  extraNames: string[] = [],
): Promise<Map<string, string>> {
  const pool = await loadCachedPoolChineseNames();
  const map = new Map(Object.entries(pool));

  const missing = extraNames
    .map((n) => n.trim())
    .filter((n) => n && !map.has(normPlayerNameKey(n)));
  if (missing.length > 0) {
    const add = await fetchChineseLabels(missing);
    for (const [k, v] of add) map.set(k, v);
  }

  return map;
}

export function displayPlayerName(
  englishName: string,
  locale: string,
  zhMap: Map<string, string> | Record<string, string> | undefined,
): string {
  if (!isChineseLocale(locale) || !englishName.trim()) return englishName;
  const map =
    zhMap instanceof Map
      ? zhMap
      : new Map(Object.entries(zhMap ?? {}));
  return map.get(normPlayerNameKey(englishName)) ?? englishName;
}
