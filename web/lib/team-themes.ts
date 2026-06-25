export type TeamTheme = {
  /** Main kit / badge background colour */
  primary: string;
  /** Secondary club colour (trim, stripes) */
  secondary: string;
  /** Legible text on `primary` */
  accent: string;
  label: string;
};

const DEFAULT_THEME: TeamTheme = {
  primary: "#00ff87",
  secondary: "#0d1f17",
  accent: "#ffffff",
  label: "FALEAGUE AI",
};

/** EPL 2026/27 club colours by FPL short code (official palette). */
const FPL_THEMES: Record<string, TeamTheme> = {
  ARS: { primary: "#EF0107", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Arsenal" },
  AVL: { primary: "#670E36", secondary: "#95BFE5", accent: "#FFFFFF", label: "Aston Villa" },
  BOU: { primary: "#DA291C", secondary: "#000000", accent: "#FFFFFF", label: "Bournemouth" },
  BRE: { primary: "#E30613", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Brentford" },
  BHA: { primary: "#0057B8", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Brighton" },
  CHE: { primary: "#034694", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Chelsea" },
  COV: { primary: "#84BCE1", secondary: "#FFFFFF", accent: "#000000", label: "Coventry" },
  CRY: { primary: "#0A4AF5", secondary: "#C4122E", accent: "#FFFFFF", label: "Crystal Palace" },
  EVE: { primary: "#004197", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Everton" },
  FUL: { primary: "#FFFFFF", secondary: "#000000", accent: "#000000", label: "Fulham" },
  HUL: { primary: "#E0A922", secondary: "#000000", accent: "#000000", label: "Hull" },
  IPS: { primary: "#0000FF", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Ipswich" },
  LEE: { primary: "#FFFFFF", secondary: "#1D428A", accent: "#1D428A", label: "Leeds" },
  LIV: { primary: "#C8102E", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Liverpool" },
  MCI: { primary: "#6CABDD", secondary: "#FFFFFF", accent: "#1C2C5B", label: "Man City" },
  MUN: { primary: "#DA291C", secondary: "#000000", accent: "#FFFFFF", label: "Man Utd" },
  NEW: { primary: "#000000", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Newcastle" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Nott'm Forest" },
  SUN: { primary: "#E52229", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Sunderland" },
  TOT: { primary: "#FFFFFF", secondary: "#132257", accent: "#132257", label: "Spurs" },
};

/** World Cup national team colours by wc_teams.code (FIFA kit / flag references). */
const WC_THEMES: Record<string, TeamTheme> = {
  ALG: { primary: "#006233", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Algeria" },
  ARG: { primary: "#75AADB", secondary: "#FFFFFF", accent: "#253081", label: "Argentina" },
  AUS: { primary: "#FFCD00", secondary: "#00843D", accent: "#00843D", label: "Australia" },
  AUT: { primary: "#ED2939", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Austria" },
  BEL: { primary: "#000000", secondary: "#FAE042", accent: "#FFFFFF", label: "Belgium" },
  BIH: { primary: "#002395", secondary: "#FECB00", accent: "#FFFFFF", label: "Bosnia" },
  BRA: { primary: "#FFDF00", secondary: "#009739", accent: "#002776", label: "Brazil" },
  CAN: { primary: "#D80621", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Canada" },
  COL: { primary: "#FCD116", secondary: "#003893", accent: "#CE1126", label: "Colombia" },
  CPV: { primary: "#003893", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Cape Verde" },
  CIV: { primary: "#FF8200", secondary: "#00954A", accent: "#FFFFFF", label: "Ivory Coast" },
  COD: { primary: "#007FFF", secondary: "#F7D618", accent: "#CE1021", label: "DR Congo" },
  CRO: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#171796", label: "Croatia" },
  CZE: { primary: "#D7141A", secondary: "#11457E", accent: "#FFFFFF", label: "Czechia" },
  CUW: { primary: "#002B7F", secondary: "#FCE300", accent: "#FFFFFF", label: "Curaçao" },
  ECU: { primary: "#FFD100", secondary: "#003087", accent: "#EF3340", label: "Ecuador" },
  EGY: { primary: "#CE1126", secondary: "#FFFFFF", accent: "#000000", label: "Egypt" },
  ENG: { primary: "#FFFFFF", secondary: "#CE1124", accent: "#001C58", label: "England" },
  ESP: { primary: "#AA151B", secondary: "#F1BF00", accent: "#FFFFFF", label: "Spain" },
  FRA: { primary: "#002654", secondary: "#ED2939", accent: "#FFFFFF", label: "France" },
  GER: { primary: "#000000", secondary: "#DD0000", accent: "#FFCE00", label: "Germany" },
  GHA: { primary: "#CE1126", secondary: "#FCD116", accent: "#006B3F", label: "Ghana" },
  HAI: { primary: "#00209F", secondary: "#D21034", accent: "#FFFFFF", label: "Haiti" },
  IRN: { primary: "#239F40", secondary: "#FFFFFF", accent: "#DA0000", label: "Iran" },
  IRQ: { primary: "#007847", secondary: "#FFFFFF", accent: "#CE1126", label: "Iraq" },
  ITA: { primary: "#005AB5", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Italy" },
  JOR: { primary: "#CE1126", secondary: "#000000", accent: "#FFFFFF", label: "Jordan" },
  JPN: { primary: "#003087", secondary: "#FFFFFF", accent: "#BC002D", label: "Japan" },
  KOR: { primary: "#CD2E3A", secondary: "#003478", accent: "#FFFFFF", label: "South Korea" },
  KSA: { primary: "#006C35", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Saudi Arabia" },
  MAR: { primary: "#C1272D", secondary: "#006233", accent: "#FFFFFF", label: "Morocco" },
  MEX: { primary: "#006847", secondary: "#FFFFFF", accent: "#CE1126", label: "Mexico" },
  NED: { primary: "#FF6600", secondary: "#21468B", accent: "#FFFFFF", label: "Netherlands" },
  NOR: { primary: "#BA0C2F", secondary: "#00205B", accent: "#FFFFFF", label: "Norway" },
  NZL: { primary: "#000000", secondary: "#FFFFFF", accent: "#FFFFFF", label: "New Zealand" },
  PAN: { primary: "#DA121A", secondary: "#072357", accent: "#FFFFFF", label: "Panama" },
  PAR: { primary: "#D52B1E", secondary: "#0038A8", accent: "#FFFFFF", label: "Paraguay" },
  POR: { primary: "#FF0000", secondary: "#006847", accent: "#FFFFFF", label: "Portugal" },
  QAT: { primary: "#8A1538", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Qatar" },
  RSA: { primary: "#007A4D", secondary: "#FFB81C", accent: "#FFFFFF", label: "South Africa" },
  SCO: { primary: "#003876", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Scotland" },
  SEN: { primary: "#00853F", secondary: "#F4E400", accent: "#FFFFFF", label: "Senegal" },
  SUI: { primary: "#FF0000", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Switzerland" },
  SWE: { primary: "#FECC00", secondary: "#006AA7", accent: "#006AA7", label: "Sweden" },
  TUN: { primary: "#E70013", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Tunisia" },
  TUR: { primary: "#E30A17", secondary: "#FFFFFF", accent: "#FFFFFF", label: "Türkiye" },
  USA: { primary: "#002868", secondary: "#BF0A30", accent: "#FFFFFF", label: "USA" },
  URU: { primary: "#7EC8E3", secondary: "#FFFFFF", accent: "#0038A8", label: "Uruguay" },
  UZB: { primary: "#0099B5", secondary: "#1EB53A", accent: "#FFFFFF", label: "Uzbekistan" },
};

export type FplBadgeStyle = {
  bg: string;
  color: string;
  stripe: string;
  rowTint: string;
  chipBg: string;
  chipBorder: string;
};

export function getFplTeamTheme(shortName: string | null | undefined): TeamTheme {
  if (!shortName) return DEFAULT_THEME;
  return FPL_THEMES[shortName.toUpperCase()] ?? DEFAULT_THEME;
}

/** Readable badge / fixture chip styling from official club colours. */
export function getFplTeamBadgeStyle(
  shortName: string | null | undefined,
): FplBadgeStyle {
  const t = getFplTeamTheme(shortName);
  return {
    bg: t.primary,
    color: t.accent,
    stripe: t.secondary,
    rowTint: `${t.primary}20`,
    chipBg: `linear-gradient(145deg, ${t.primary} 0%, color-mix(in srgb, ${t.primary} 72%, ${t.secondary}) 100%)`,
    chipBorder: `color-mix(in srgb, ${t.primary} 55%, transparent)`,
  };
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
