import teamCodesJson from "@/data/fpl-team-codes.json";

export type FplTeamCodeEntry = {
  code: string;
  short_name: string;
  name: string;
};

export const FPL_TEAM_CODES: FplTeamCodeEntry[] = teamCodesJson.teams;

const shortByCode = new Map<string, string>();
const nameByCode = new Map<string, string>();

for (const team of FPL_TEAM_CODES) {
  if (team.short_name) shortByCode.set(team.code, team.short_name);
  if (team.name) nameByCode.set(team.code, team.name);
}

/** Stable FPL ``team_code`` → three/four-letter label (e.g. ``57`` → ``WAT``). */
export function fplTeamShortByCode(): Readonly<Record<string, string>> {
  return Object.fromEntries(shortByCode);
}

/** Stable FPL ``team_code`` → full club name (e.g. ``57`` → ``Watford``). */
export function fplTeamNameByCode(): Readonly<Record<string, string>> {
  return Object.fromEntries(nameByCode);
}

export function fplTeamShortLabel(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return shortByCode.get(code.trim());
}

export function fplTeamFullName(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return nameByCode.get(code.trim());
}
