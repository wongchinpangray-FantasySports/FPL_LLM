import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";
import { isChineseLocale } from "@/lib/wc/player-names-zh";

/** FIFA / WC team code → Simplified Chinese (体育媒体常用译名). */
export const WC_TEAM_ZH_BY_CODE: Record<string, string> = {
  MEX: "墨西哥",
  KOR: "韩国",
  RSA: "南非",
  CZE: "捷克",
  CAN: "加拿大",
  SUI: "瑞士",
  QAT: "卡塔尔",
  BIH: "波黑",
  BRA: "巴西",
  MAR: "摩洛哥",
  SCO: "苏格兰",
  HAI: "海地",
  USA: "美国",
  PAR: "巴拉圭",
  AUS: "澳大利亚",
  TUR: "土耳其",
  GER: "德国",
  ECU: "厄瓜多尔",
  CIV: "科特迪瓦",
  CUW: "库拉索",
  NED: "荷兰",
  JPN: "日本",
  TUN: "突尼斯",
  SWE: "瑞典",
  BEL: "比利时",
  IRN: "伊朗",
  EGY: "埃及",
  NZL: "新西兰",
  ESP: "西班牙",
  URU: "乌拉圭",
  KSA: "沙特",
  CPV: "佛得角",
  FRA: "法国",
  SEN: "塞内加尔",
  NOR: "挪威",
  IRQ: "伊拉克",
  ARG: "阿根廷",
  AUT: "奥地利",
  ALG: "阿尔及利亚",
  JOR: "约旦",
  POR: "葡萄牙",
  COL: "哥伦比亚",
  UZB: "乌兹别克斯坦",
  COD: "刚果（金）",
  ENG: "英格兰",
  CRO: "克罗地亚",
  PAN: "巴拿马",
  GHA: "加纳",
};

const BY_EN_NAME = new Map(
  WC_GROUP_TEAMS.map((t) => [t.name.toLowerCase(), t.code]),
);

export function displayTeamName(
  code: string | null | undefined,
  englishName: string,
  locale: string,
): string {
  if (!isChineseLocale(locale)) return englishName;
  const c = code?.trim().toUpperCase();
  if (c && WC_TEAM_ZH_BY_CODE[c]) return WC_TEAM_ZH_BY_CODE[c];
  const fromName = BY_EN_NAME.get(englishName.trim().toLowerCase());
  if (fromName && WC_TEAM_ZH_BY_CODE[fromName]) return WC_TEAM_ZH_BY_CODE[fromName];
  return englishName;
}
