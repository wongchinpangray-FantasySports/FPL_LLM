/** Clubs / leagues treated as “already on everyone’s radar” for WC scouting. */

const SPOTLIGHT_NAME_PATTERNS = [
  /\breal madrid\b/i,
  /\bbarcelona\b/i,
  /\bbayern\b/i,
  /\bparis saint-germain\b/i,
  /\bparis sg\b/i,
  /\bpsg\b/i,
];

/** FPL `teams` rows are Premier League clubs — any linked player is excluded. */
export function isPremierLeagueFplPlayer(hasFplId: boolean): boolean {
  return hasFplId;
}

export function isMegaClubName(clubName: string | null | undefined): boolean {
  if (!clubName?.trim()) return false;
  const n = clubName.trim();
  return SPOTLIGHT_NAME_PATTERNS.some((re) => re.test(n));
}

export function isScoutingExcluded(opts: {
  fpl_id: number | null;
  club_name?: string | null;
  /** Matched to FPL / Premier League via stored id or name resolution. */
  epl_club?: boolean;
}): boolean {
  if (opts.epl_club || isPremierLeagueFplPlayer(opts.fpl_id != null)) return true;
  if (isMegaClubName(opts.club_name)) return true;
  return false;
}
