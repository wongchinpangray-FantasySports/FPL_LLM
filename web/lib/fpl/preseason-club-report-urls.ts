import type { PreseasonMatchRef } from "@/lib/fpl/preseason-sources";

const HTML_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export function slugifyTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function opponentMatchSlug(opponent: string): string {
  const slug = slugifyTeam(opponent);
  const aliases: Record<string, string> = {
    rosenborg: "rosenborg-bk",
    "st-pauli": "st-pauli",
    "western-sydney-wanderers": "western-sydney-wanderers",
    "mk-dons": "milton-keynes-dons",
    "milton-keynes-dons": "milton-keynes-dons",
    "auckland-fc": "auckland-fc",
    "sydney-fc": "sydney-fc",
  };
  return aliases[slug] ?? slug;
}

export function manUtdMatchCentreUrls(match: PreseasonMatchRef): string[] {
  const date = match.date.replace(/-/g, "");
  const opp = opponentMatchSlug(match.opponent);
  if (match.pl_home) {
    return [
      `https://www.manutd.com/en/matches/mens-team/manchester-united-v-${opp}-friendly-${date}?tab=live`,
      `https://www.manutd.com/en/matches/mens-team/manchester-united-v-${opp}-friendly-${date}?tab=report`,
    ];
  }
  return [
    `https://www.manutd.com/en/matches/mens-team/${opp}-v-manchester-united-friendly-${date}?tab=live`,
    `https://www.manutd.com/en/matches/mens-team/${opp}-v-manchester-united-friendly-${date}?tab=report`,
  ];
}

function dateParts(date: string): { y: string; m: string; d: string; ymd: string } {
  const [y, m, d] = date.split("-");
  return { y, m, d, ymd: `${y}${m}${d}` };
}

function scoreSlug(match: PreseasonMatchRef): string | null {
  if (match.pl_goals == null || match.opp_goals == null) return null;
  return `${match.pl_goals}-${match.opp_goals}`;
}

function newsReportSlug(match: PreseasonMatchRef, clubSlug: string): string[] {
  const opp = slugifyTeam(match.opponent);
  const score = scoreSlug(match);
  if (!score) return [];
  return [
    `match-report-${clubSlug}-${score}-${opp}`,
    `pre-season-report-${clubSlug}-vs-${opp}`,
  ];
}

function chelseaMatchUrls(match: PreseasonMatchRef): string[] {
  const opp = slugifyTeam(match.opponent);
  const { ymd } = dateParts(match.date);
  const bases = [
    `chelsea-vs-${opp}-sydney-super-cup-${match.date}`,
    `chelsea-vs-${opp}-mens-friendly-${ymd.slice(6)}${ymd.slice(4, 6)}${ymd.slice(2, 4)}`,
    `chelsea-vs-${opp}-pre-season-friendly-${match.date}`,
    `chelsea-vs-${opp}-friendly-${match.date}`,
  ];
  const urls = bases.map((b) => `https://www.chelseafc.com/en/matches/${b}`);
  const score = scoreSlug(match);
  if (score) {
    urls.push(
      `https://www.chelseafc.com/en/news/article/match-report-chelsea-${score}-${opp}`,
    );
  }
  return urls;
}

function manCityMatchUrls(match: PreseasonMatchRef): string[] {
  const opp = slugifyTeam(match.opponent);
  const { y, m, d } = dateParts(match.date);
  const oppShort = opp.replace(/-fc$/, "").replace(/-bk$/, "");
  return [
    `https://www.mancity.com/matchday/fixtures/mens/${y}/${oppShort}-v-city-${Number(d)}-${Number(m)}-${y}`,
    `https://www.mancity.com/matchday/fixtures/mens/${y}/${opp}-v-manchester-city-${Number(d)}-${Number(m)}-${y}`,
    `https://www.mancity.com/matchday/fixtures/mens/${y}/${opp}-v-city-${Number(d)}-${Number(m)}-${y}`,
  ];
}

function arsenalMatchUrls(match: PreseasonMatchRef): string[] {
  const opp = slugifyTeam(match.opponent);
  return [
    `https://www.arsenal.com/news/pre-season-${opp}`,
    `https://www.arsenal.com/news/match-report-${opp}`,
  ];
}

function liverpoolMatchUrls(match: PreseasonMatchRef): string[] {
  const opp = slugifyTeam(match.opponent);
  const score = scoreSlug(match);
  return [
    `https://www.liverpoolfc.com/news/report-reds-beat-${opp}`,
    score ? `https://www.liverpoolfc.com/news/liverpool-${score}-${opp}` : "",
  ].filter(Boolean);
}

function genericNewsUrls(
  domain: string,
  pathPrefix: string,
  clubSlug: string,
  match: PreseasonMatchRef,
): string[] {
  const opp = slugifyTeam(match.opponent);
  const score = scoreSlug(match);
  const slugs = [
    ...newsReportSlug(match, clubSlug),
    `pre-season-${clubSlug}-vs-${opp}`,
    `match-report-${clubSlug}-vs-${opp}`,
    score ? `${clubSlug}-${score}-${opp}` : "",
  ].filter(Boolean);
  return slugs.map((s) => `https://${domain}${pathPrefix}/${s}`);
}

/** Static URL candidates per club (probed separately). */
export function buildClubReportUrlCandidates(match: PreseasonMatchRef): string[] {
  const opp = slugifyTeam(match.opponent);
  const score = scoreSlug(match);

  const byCode: Partial<Record<string, string[]>> = {
    MUN: manUtdMatchCentreUrls(match),
    CHE: chelseaMatchUrls(match),
    MCI: manCityMatchUrls(match),
    ARS: arsenalMatchUrls(match),
    LIV: liverpoolMatchUrls(match),
    BRE: [
      score
        ? `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${match.pl_goals}-${opp}-${match.opp_goals}`
        : "",
      score
        ? `https://www.brentfordfc.com/en/news/article/match-reports-brentford-${match.pl_goals}-${opp}-${match.opp_goals}-behind-closed-doors-friendly-jaidon-anthony`
        : "",
    ].filter(Boolean),
    BHA: [
      `https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-${opp}-july-2026`,
      "https://www.brightonandhovealbion.com/media-article/mft-match-report-pre-season-friendly-brighton-wycombe-wanderers-july-2026",
    ],
    BOU: [
      "https://www.bbc.com/sport/football/articles/crrvd719xkwo",
      "https://www.bbc.co.uk/sport/football/articles/crrvd719xkwo",
    ],
    AVL: genericNewsUrls("www.avfc.co.uk", "/news", "aston-villa", match),
    NEW: [
      "https://www.newcastleunited.com/en/news/confirmed-line-up-steur-starts-at-gateshead",
    ],
    NFO: genericNewsUrls(
      "www.nottinghamforest.co.uk",
      "/news",
      "nottingham-forest",
      match,
    ),
    WHU: genericNewsUrls("www.whufc.com", "/news", "west-ham", match),
    WOL: genericNewsUrls("www.wolves.co.uk", "/news", "wolves", match),
    CRY: genericNewsUrls("www.cpfc.co.uk", "/news", "crystal-palace", match),
    EVE: genericNewsUrls("www.evertonfc.com", "/news", "everton", match),
    FUL: genericNewsUrls("www.fulhamfc.com", "/news", "fulham", match),
    LEE: [
      `https://www.leedsunited.com/en/news/pre-season-report-leeds-united-vs-${opp}`,
    ],
    IPS: genericNewsUrls("www.itfc.co.uk", "/news", "ipswich-town", match),
    SUN: genericNewsUrls("www.safc.com", "/news", "sunderland", match),
  };

  return [...new Set(byCode[match.pl_code] ?? [])];
}

export async function probeReportUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: HTML_FETCH_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

export async function guessClubReportUrls(
  match: PreseasonMatchRef,
): Promise<string[]> {
  const candidates = buildClubReportUrlCandidates(match);
  const out: string[] = [];
  for (const url of candidates) {
    if (await probeReportUrl(url)) out.push(url);
  }
  return out;
}
