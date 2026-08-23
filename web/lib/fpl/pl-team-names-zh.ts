/** Premier League club names for WeChat / zh copy. Keyed by FPL `short_name`. */
export const PL_TEAM_ZH: Record<string, string> = {
  ARS: "阿森纳",
  AVL: "维拉",
  BHA: "布莱顿",
  BOU: "伯恩茅斯",
  BRE: "布伦特福德",
  CHE: "切尔西",
  COV: "考文垂",
  CRY: "水晶宫",
  EVE: "埃弗顿",
  FUL: "富勒姆",
  HUL: "赫尔城",
  IPS: "伊普斯维奇",
  LEE: "利兹联",
  LIV: "利物浦",
  MCI: "曼城",
  MUN: "曼联",
  NEW: "纽卡斯尔",
  NFO: "森林",
  SUN: "桑德兰",
  TOT: "热刺",
  WHU: "西汉姆",
  WOL: "狼队",
  BUR: "伯恩利",
  LEI: "莱斯特",
  SOU: "南安普顿",
  SHU: "谢菲联",
};

export function plTeamNameZh(
  shortName: string | null | undefined,
  fallback?: string | null,
): string {
  const code = String(shortName ?? "").trim().toUpperCase();
  if (code && PL_TEAM_ZH[code]) return PL_TEAM_ZH[code];
  const name = (fallback ?? "").trim();
  return name || code || "—";
}
