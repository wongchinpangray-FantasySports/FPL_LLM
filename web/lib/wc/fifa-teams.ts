import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";

const WC_CODES = new Set(WC_GROUP_TEAMS.map((t) => t.code));

/** FIFA bootstrap team labels → our `wc_teams.code`. */
const FIFA_LABEL_TO_CODE: Record<string, string> = {
  "KOREA REPUBLIC": "KOR",
  "SOUTH KOREA": "KOR",
  "REPUBLIC OF KOREA": "KOR",
  "UNITED STATES": "USA",
  "UNITED STATES OF AMERICA": "USA",
  "US": "USA",
  "USA": "USA",
  "IVORY COAST": "CIV",
  "CÔTE D'IVOIRE": "CIV",
  "COTE D'IVOIRE": "CIV",
  "DR CONGO": "COD",
  "DEMOCRATIC REPUBLIC OF CONGO": "COD",
  "CONGO DR": "COD",
  "SAUDI ARABIA": "KSA",
  "KSA": "KSA",
  "CAPE VERDE": "CPV",
  "CABO VERDE": "CPV",
  "BOSNIA AND HERZEGOVINA": "BIH",
  "BOSNIA & HERZEGOVINA": "BIH",
  "CZECHIA": "CZE",
  "CZECH REPUBLIC": "CZE",
  "TURKIYE": "TUR",
  "TURKEY": "TUR",
  "CURACAO": "CUW",
  "CURAÇAO": "CUW",
  "NETHERLANDS": "NED",
  "HOLLAND": "NED",
  "IRAN": "IRN",
  "IRAN ISLAMIC REPUBLIC": "IRN",
  "NEW ZEALAND": "NZL",
  "SOUTH AFRICA": "RSA",
  "ENGLAND": "ENG",
  "WALES": "WAL",
  "SCOTLAND": "SCO",
  "NORTHERN IRELAND": "NIR",
};

const NAME_TO_CODE = new Map(
  WC_GROUP_TEAMS.flatMap((t) => [
    [t.name.toUpperCase(), t.code],
    [t.short.toUpperCase(), t.code],
    [t.code, t.code],
  ]),
);

function normLabel(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Map a FIFA bootstrap team row to our 3-letter `wc_teams.code`. */
export function fifaTeamToWcCode(team: {
  id?: number;
  code?: number | string;
  name?: string;
  short_name?: string;
}): string | null {
  const candidates = [
    normLabel(team.short_name),
    normLabel(team.code),
    normLabel(team.name),
  ].filter(Boolean);

  for (const label of candidates) {
    if (WC_CODES.has(label)) return label;
    if (FIFA_LABEL_TO_CODE[label]) return FIFA_LABEL_TO_CODE[label];
    if (NAME_TO_CODE.has(label)) return NAME_TO_CODE.get(label)!;
    if (label.length === 3 && WC_CODES.has(label.slice(0, 3))) return label.slice(0, 3);
  }

  const name = normLabel(team.name);
  if (name) {
    for (const t of WC_GROUP_TEAMS) {
      const tn = t.name.toUpperCase();
      if (name === tn || name.includes(tn) || tn.includes(name)) return t.code;
    }
    const alias = FIFA_LABEL_TO_CODE[name];
    if (alias) return alias;
  }

  return null;
}
