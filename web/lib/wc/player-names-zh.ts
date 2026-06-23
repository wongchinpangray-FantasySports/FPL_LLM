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

/** FIFA display names & common WC pool names → 简体中文 (curated). */
export const PLAYER_ZH_OVERRIDES: Record<string, string> = {
  "lionel messi": "梅西",
  "deniz undav": "翁达夫",
  "jonathan david": "乔纳森·戴维",
  "kylian mbappé": "姆巴佩",
  "kylian mbappe": "姆巴佩",
  "ayase ueda": "上田绮世",
  "alexander isak": "伊萨克",
  "mohamed salah": "萨拉赫",
  "brahim díaz": "布拉欣·迪亚斯",
  "brahim diaz": "布拉欣·迪亚斯",
  "chris wood": "克里斯·伍德",
  "erling haaland": "哈兰德",
  "harry kane": "哈里·凯恩",
  "bukayo saka": "布卡约·萨卡",
  "kevin de bruyne": "德布劳内",
  "rodri": "罗德里",
  "vinícius júnior": "维尼修斯",
  "vinicius junior": "维尼修斯",
  "luka modrić": "莫德里奇",
  "luka modric": "莫德里奇",
  "jude bellingham": "贝林厄姆",
  "phil foden": "福登",
  "cole palmer": "帕尔默",
  "declan rice": "赖斯",
  "martin ødegaard": "厄德高",
  "martin odegaard": "厄德高",
  "virgil van dijk": "范戴克",
  "alisson becker": "阿利松",
  "gabriel magalhães": "加布里埃尔",
  "gabriel magalhaes": "加布里埃尔",
  "william saliba": "萨利巴",
  "pedri": "佩德里",
  "gavi": "加维",
  "lamine yamal": "亚马尔",
  "federico valverde": "巴尔韦德",
  "federico chiesa": "基耶萨",
  "lautaro martínez": "劳塔罗·马丁内斯",
  "lautaro martinez": "劳塔罗·马丁内斯",
  "julian alvarez": "胡利安·阿尔瓦雷斯",
  "enzo fernández": "恩佐·费尔南德斯",
  "enzo fernandez": "恩佐·费尔南德斯",
  "alexis mac allister": "麦卡利斯特",
  "darwin núñez": "达尔文·努涅斯",
  "darwin nunez": "达尔文·努涅斯",
  "diogo jota": "若塔",
  "heung-min son": "孙兴慜",
  "son heung-min": "孙兴慜",
  "kim min-jae": "金玟哉",
  "park ji-sung": "朴智星",
  "christian pulisic": "普利西奇",
  "weston mckennie": "麦肯尼",
  "achraf hakimi": "阿什拉夫",
  "bruno fernandes": "布鲁诺·费尔南德斯",
  "bernardo silva": "贝尔纳多·席尔瓦",
  "raphinha": "拉菲尼亚",
  "ousmane dembélé": "登贝莱",
  "ousmane dembele": "登贝莱",
  "kingsley coman": "科曼",
  "jamal musiala": "穆西亚拉",
  "florian wirtz": "维尔茨",
  "nicolas pépé": "佩佩",
  "nicolas pepe": "佩佩",
  "victor osimhen": "奥斯梅恩",
  "achraf dari": "阿什拉夫·达里",
  "youssef en-nesyri": "恩-内斯里",
  "sadio mané": "马内",
  "sadio mane": "马内",
  "dominik szoboszlai": "索博斯洛伊",
  "florian thauvin": "托万",
  "antoine griezmann": "格列兹曼",
  "olivier giroud": "吉鲁",
  "aurelien tchouameni": "楚阿梅尼",
  "aurélien tchouaméni": "楚阿梅尼",
  "william pacho": "威廉·帕乔",
  "jeremie frimpong": "弗林蓬",
  "xavi simons": "哈维·西蒙斯",
  "donyell malen": "马伦",
  "cody gakpo": "加克波",
  "memphis depay": "德佩",
  "frenkie de jong": "弗朗基·德容",
  "matthijs de ligt": "德里赫特",
  "georginio wijnaldum": "维纳尔杜姆",
  "nigel de jong": "尼格尔·德容",
  "jerdy schouten": "斯豪滕",
  "bryan gil": "布莱恩·希尔",
  "ferran torres": "费兰·托雷斯",
  "pablo pino": "皮诺",
  "nicolas pino": "皮诺",
};

function toTitleCaseWords(name: string): string {
  return name.trim().replace(/\S+/g, (word) => {
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function lookupPlayerZh(
  map: Map<string, string>,
  englishName: string,
): string | undefined {
  const key = normPlayerNameKey(englishName);
  const direct = map.get(key);
  if (direct) return direct;
  const titled = normPlayerNameKey(toTitleCaseWords(englishName));
  if (titled !== key) return map.get(titled);
  return undefined;
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
  FILTER(LANG(?zh) IN ("zh", "zh-cn", "zh-hans", "zh-hant"))
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
  const map = new Map<string, string>(Object.entries(PLAYER_ZH_OVERRIDES));

  const pool = await loadCachedPoolChineseNames();
  for (const [k, v] of Object.entries(pool)) {
    if (!map.has(k)) map.set(k, v);
  }

  const missing = extraNames
    .map((n) => n.trim())
    .filter((n) => n && !lookupPlayerZh(map, n));
  if (missing.length > 0) {
    const add = await fetchChineseLabels(missing);
    for (const [k, v] of add) {
      if (!map.has(k)) map.set(k, v);
    }
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
      : new Map(Object.entries({ ...PLAYER_ZH_OVERRIDES, ...(zhMap ?? {}) }));
  return lookupPlayerZh(map, englishName) ?? englishName;
}
