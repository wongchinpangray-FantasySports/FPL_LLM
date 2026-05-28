import { wcTeamFullName } from "@/lib/wc/team-names";

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
const USER_AGENT = "FPL-LLM/1.0 (World Cup scouting; contact: faleague-ai.com)";

export type WikidataClubResult = {
  club: string;
  league: string | null;
};

function escapeSparqlString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Current domestic club via Wikidata (free, no API key). */
export async function fetchWikidataClub(
  playerName: string,
  nationCode?: string,
): Promise<WikidataClubResult | null> {
  const name = playerName.trim();
  if (!name) return null;

  const nation = nationCode ? wcTeamFullName(nationCode) : null;
  const nationFilter = nation
    ? `
    ?player wdt:P27 ?country .
    ?country rdfs:label ?countryLabel .
    FILTER(LANG(?countryLabel) = "en" && LCASE(STR(?countryLabel)) = "${escapeSparqlString(nation.toLowerCase())}")
  `
    : "";

  const query = `
SELECT ?clubLabel ?leagueLabel WHERE {
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  ?player rdfs:label "${escapeSparqlString(name)}"@en ;
         wdt:P106 wd:Q937857 .
  ${nationFilter}
  ?player p:P54 ?stmt .
  ?stmt ps:P54 ?club .
  FILTER NOT EXISTS { ?stmt pq:P582 ?end }
  ?club wdt:P31/wdt:P279* wd:Q476028 .
  ?club rdfs:label ?clubLabel .
  FILTER(LANG(?clubLabel) = "en")
  OPTIONAL {
    ?club wdt:P118 ?league .
    ?league wdt:P31/wdt:P279* wd:Q623109 .
    ?league rdfs:label ?leagueLabel .
    FILTER(LANG(?leagueLabel) = "en")
  }
}
LIMIT 3
`;

  const url = `${WIKIDATA_SPARQL}?format=json&query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      results?: {
        bindings?: {
          clubLabel?: { value?: string };
          leagueLabel?: { value?: string };
        }[];
      };
    };

    const row = json.results?.bindings?.[0];
    const club = row?.clubLabel?.value?.trim();
    if (!club) return null;

    const league = row?.leagueLabel?.value?.trim() || null;
    return { club, league };
  } catch {
    return null;
  }
}
