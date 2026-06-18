export type TeamTheme = {
  primary: string;
  secondary: string;
  accent: string;
  label: string;
};

const DEFAULT_THEME: TeamTheme = {
  primary: "#00ff87",
  secondary: "#0d1f17",
  accent: "#ffffff",
  label: "FALEAGUE AI",
};

/** EPL club colours by FPL short code. */
const FPL_THEMES: Record<string, TeamTheme> = {
  ARS: { primary: "#EF0107", secondary: "#023474", accent: "#FFFFFF", label: "Arsenal" },
  AVL: { primary: "#95BFE5", secondary: "#670E36", accent: "#FFFFFF", label: "Aston Villa" },
  BOU: { primary: "#DA291C", secondary: "#000000", accent: "#FFFFFF", label: "Bournemouth" },
  BRE: { primary: "#E30613", secondary: "#FBB800", accent: "#FFFFFF", label: "Brentford" },
  BHA: { primary: "#0057B8", secondary: "#FFFFFF", accent: "#FFCD00", label: "Brighton" },
  CHE: { primary: "#034694", secondary: "#001489", accent: "#FFFFFF", label: "Chelsea" },
  CRY: { primary: "#1B458F", secondary: "#C4122E", accent: "#FFFFFF", label: "Crystal Palace" },
  EVE: { primary: "#003399", secondary: "#FFFFFF", accent: "#003399", label: "Everton" },
  FUL: { primary: "#000000", secondary: "#CC0000", accent: "#FFFFFF", label: "Fulham" },
  IPS: { primary: "#0033A0", secondary: "#FFFFFF", accent: "#0033A0", label: "Ipswich" },
  LEI: { primary: "#003090", secondary: "#FDBE11", accent: "#FFFFFF", label: "Leicester" },
  LIV: { primary: "#C8102E", secondary: "#00B2A9", accent: "#FFFFFF", label: "Liverpool" },
  MCI: { primary: "#6CABDD", secondary: "#1C2C5B", accent: "#FFFFFF", label: "Man City" },
  MUN: { primary: "#DA291C", secondary: "#FBE122", accent: "#FFFFFF", label: "Man Utd" },
  NEW: { primary: "#241F20", secondary: "#FFFFFF", accent: "#00B2A9", label: "Newcastle" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF", accent: "#DD0000", label: "Nott'm Forest" },
  SOU: { primary: "#D71920", secondary: "#130C0E", accent: "#FFFFFF", label: "Southampton" },
  TOT: { primary: "#132257", secondary: "#FFFFFF", accent: "#132257", label: "Tottenham" },
  WHU: { primary: "#7A263A", secondary: "#1BB1E7", accent: "#FFFFFF", label: "West Ham" },
  WOL: { primary: "#FDB913", secondary: "#231F20", accent: "#FFFFFF", label: "Wolves" },
};

/** World Cup national team colours by wc_teams.code. */
const WC_THEMES: Record<string, TeamTheme> = {
  ARG: { primary: "#74ACDF", secondary: "#FFFFFF", accent: "#F6B40E", label: "Argentina" },
  AUS: { primary: "#FFCD00", secondary: "#00843D", accent: "#FFFFFF", label: "Australia" },
  BEL: { primary: "#FAE042", secondary: "#ED2939", accent: "#000000", label: "Belgium" },
  BRA: { primary: "#FFDF00", secondary: "#009739", accent: "#002776", label: "Brazil" },
  CAN: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#FF0000", label: "Canada" },
  COL: { primary: "#FCD116", secondary: "#003893", accent: "#CE1126", label: "Colombia" },
  CRO: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#171796", label: "Croatia" },
  ENG: { primary: "#FFFFFF", secondary: "#CE1124", accent: "#00247D", label: "England" },
  ESP: { primary: "#AA151B", secondary: "#F1BF00", accent: "#AA151B", label: "Spain" },
  FRA: { primary: "#002654", secondary: "#ED2939", accent: "#FFFFFF", label: "France" },
  GER: { primary: "#000000", secondary: "#DD0000", accent: "#FFCE00", label: "Germany" },
  ITA: { primary: "#009246", secondary: "#FFFFFF", accent: "#CE2B37", label: "Italy" },
  JPN: { primary: "#BC002D", secondary: "#FFFFFF", accent: "#BC002D", label: "Japan" },
  KOR: { primary: "#CD2E3A", secondary: "#0047A0", accent: "#FFFFFF", label: "South Korea" },
  MEX: { primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126", label: "Mexico" },
  NED: { primary: "#FF6600", secondary: "#21468B", accent: "#FFFFFF", label: "Netherlands" },
  POR: { primary: "#006600", secondary: "#FF0000", accent: "#FFFFFF", label: "Portugal" },
  SUI: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#FF0000", label: "Switzerland" },
  USA: { primary: "#BF0A30", secondary: "#002868", accent: "#FFFFFF", label: "USA" },
  URU: { primary: "#55B7FF", secondary: "#FFFFFF", accent: "#0038A8", label: "Uruguay" },
};

export function getFplTeamTheme(shortName: string | null | undefined): TeamTheme {
  if (!shortName) return DEFAULT_THEME;
  return FPL_THEMES[shortName.toUpperCase()] ?? DEFAULT_THEME;
}

export function getWcTeamTheme(code: string | null | undefined): TeamTheme {
  if (!code) return DEFAULT_THEME;
  return WC_THEMES[code.toUpperCase()] ?? DEFAULT_THEME;
}

export function resolveAccountTheme(opts: {
  themeTeamType: "club" | "national";
  fplShortName: string | null;
  nationalTeamCode: string | null;
}): TeamTheme {
  if (opts.themeTeamType === "national" && opts.nationalTeamCode) {
    return getWcTeamTheme(opts.nationalTeamCode);
  }
  if (opts.fplShortName) {
    return getFplTeamTheme(opts.fplShortName);
  }
  if (opts.nationalTeamCode) {
    return getWcTeamTheme(opts.nationalTeamCode);
  }
  return DEFAULT_THEME;
}

export { DEFAULT_THEME };
