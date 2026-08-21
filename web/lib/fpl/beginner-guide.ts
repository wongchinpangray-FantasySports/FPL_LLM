/**
 * FPL beginner manual — Chinese copy aligned with official rules
 * (fantasy.premierleague.com/help, FPL Rules).
 */

export type GuideTableRow = { action: string; points: string };

export type GuideSection = {
  id: string;
  num: number;
  title: string;
  bullets: string[];
  subsections?: { label: string; bullets: string[] }[];
  table?: GuideTableRow[];
  note?: string;
};

export const FPL_BEGINNER_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "what-is-fpl",
    num: 1,
    title: "FPL 是什么？",
    bullets: [
      "Fantasy Premier League（FPL）是英超官方免费 Fantasy 游戏。",
      "你有 £100.0m 预算，从真实英超球员中挑选 15 人组建球队。",
      "赛季共 38 个 Gameweek（GW）；每轮根据球员真实比赛表现获得积分。",
      "每轮从 15 人中选 11 人首发，设队长（积分 ×2）与副队长；其余 4 人坐替补席。",
      "可加入 Mini League 与好友、同事或全球经理比拼排名。",
    ],
  },
  {
    id: "register",
    num: 2,
    title: "注册与创建球队",
    bullets: [
      "打开 fantasy.premierleague.com → 点击 Register 注册。",
      "填写邮箱、密码与 Manager Name（经理昵称），到邮箱完成验证。",
      "登录后创建 Team Name（你的 Fantasy 队名，可稍后修改）。",
    ],
  },
  {
    id: "pick-squad",
    num: 3,
    title: "挑选 15 人阵容",
    bullets: [
      "进入 Pick Team / Transfers 页面，按位置筛选：GK / DEF / MID / FWD。",
      "阵容结构固定：2 门将 · 5 后卫 · 5 中场 · 3 前锋。",
      "总身价不得超过 £100.0m；顶部预算条实时显示剩余金额。",
      "同一英超俱乐部最多选 3 名球员。",
      "选满 15 人后点击 Submit / Enter 提交。",
    ],
    note: "球员价格在赛季开始后随转会市场热度波动；季前选队期间价格不变。",
  },
  {
    id: "starting-xi",
    num: 4,
    title: "首发、队长与替补",
    bullets: [
      "切换到 Pitch（球场）视图，从 15 人中确定每轮 11 人首发。",
      "阵型必须满足：1 门将 · 至少 3 后卫 · 至少 2 中场 · 至少 1 前锋（常见 3-5-2、4-4-2、4-3-3 等）。",
      "点球员设置 Captain (C) 与 Vice Captain (V)；队长积分 ×2，若队长未出场则自动换为副队长。",
      "若队长与副队长均未出场，则本轮无人享受双倍积分。",
    ],
  },
  {
    id: "deadline-weekly",
    num: 5,
    title: "每轮 Deadline 与每周操作",
    bullets: [
      "所有变更（首发、换人、队长、替补顺序）须在当轮 Deadline 前完成。",
      "Deadline 通常为该 GW 首场比赛开球前 90 分钟（赛前 24 小时内一般不再变动）。",
      "每轮开始前检查：伤病、停赛、赛程（双赛 / 轮空 GW）、是否需调整首发或队长。",
      "在 Leagues 页面可创建或加入 Mini League，与好友比拼当轮与总排名。",
    ],
  },
  {
    id: "transfers",
    num: 6,
    title: "转会规则",
    bullets: [
      "赛季首个 Deadline 之前：无限免费转会。",
      "之后每轮获得 1 次免费转会；未使用可累积至下一轮，最多存 5 次。",
      "超出免费额度的换人，每个额外转会 -4 分（俗称 taking a hit）。",
      "买人必须卖人，且位置相同（卖中场才能买中场）；新球员须符合 £100m 总预算与同队 3 人上限。",
      "卖出价可能低于买入价：球员涨价后，你仅保留一半涨幅（向下取整至 £0.1m）。",
      "单轮最多 20 次转会（使用 Wildcard 或 Free Hit 芯片时不受此限）。",
    ],
  },
  {
    id: "scoring",
    num: 7,
    title: "积分规则",
    bullets: [
      "球员积分来自真实比赛数据：出场、进球、助攻、零封、扑救、防守贡献、Bonus 等。",
      "队长积分 ×2；使用 Triple Captain 芯片时为 ×3。",
      "零封（Clean Sheet）：门将/后卫 +4，中场 +1；须上场 ≥60 分钟且该时段球队未失球。",
      "门将每 3 次扑救 +1；扑点 +5；射失点球 -2。",
      "Bonus 由官方算法根据当场表现分配，每名球员 0–3 分。",
    ],
    table: [
      { action: "出场 ≤60 分钟", points: "+1" },
      { action: "出场 ≥60 分钟", points: "+2" },
      { action: "门将进球", points: "+10" },
      { action: "后卫进球", points: "+6" },
      { action: "中场进球", points: "+5" },
      { action: "前锋进球", points: "+4" },
      { action: "助攻", points: "+3" },
      { action: "零封（GK/DEF）", points: "+4" },
      { action: "零封（MID）", points: "+1" },
      { action: "门将每 3 次扑救", points: "+1" },
      { action: "防守贡献达标（DEF 10+ CBI&T）", points: "+2" },
      { action: "防守贡献达标（MID/FWD 12+ CBI&T&R）", points: "+2" },
      { action: "扑点", points: "+5" },
      { action: "射失点球", points: "-2" },
      { action: "Bonus（单场）", points: "0–3" },
      { action: "门将/后卫每失 2 球", points: "-1" },
      { action: "黄牌", points: "-1" },
      { action: "红牌", points: "-3" },
      { action: "乌龙球", points: "-2" },
    ],
    note: "防守贡献（DC）不叠加：一场达标即 +2，达到 20 次动作也不会 +4。",
  },
  {
    id: "chips",
    num: 8,
    title: "芯片（Chips）",
    bullets: [
      "每轮只能使用 1 枚芯片；在 Pick Team 或 Transfers 页面激活。",
      "赛季分上下半场各一套芯片；未在有效期内使用即作废，不可顺延。",
      "Wildcard / Free Hit 使用后不可撤销；Bench Boost / Triple Captain 可在 Deadline 前取消。",
      "使用 Wildcard 或 Free Hit 时，已累积的免费转会次数会保留至下一轮。",
      "Free Hit 不可在连续两个 GW 使用。",
    ],
    table: [
      { action: "Wildcard 通配符", points: "当轮无限免费转会，可重建阵容" },
      { action: "Free Hit 免费换人", points: "当轮无限转会，下一轮恢复原阵容" },
      { action: "Bench Boost 替补加分", points: "当轮 15 人全部计分" },
      { action: "Triple Captain 三倍队长", points: "当轮队长积分 ×3 而非 ×2" },
    ],
    note: "上半场芯片（含 Wildcard、Free Hit、Bench Boost、Triple Captain）须在 GW19 Deadline 前使用；下半场芯片在 GW19 之后开放。",
  },
  {
    id: "glossary",
    num: 9,
    title: "常用术语",
    bullets: [
      "GW / Gameweek：比赛轮次，通常一个周末为一轮。",
      "Deadline：该轮阵容锁定时间，之后无法修改当轮首发与芯片。",
      "Template：高拥有率、大众模板球员。",
      "Differential：低拥有率差分球员，用来冲排名。",
      "xP / xPts：预期积分，基于模型或历史数据的参考值。",
      "FDR：Fixture Difficulty Rating，赛程难度参考。",
      "Hit：额外转会扣分（每个 -4）。",
      "BB / TC / FH / WC：Bench Boost / Triple Captain / Free Hit / Wildcard。",
    ],
  },
];

/** Poster pages for XHS carousel (subset / reformatted for 1080×1440). */
export type GuidePosterPage = {
  page: number;
  total: number;
  eyebrow: string;
  title: string;
  titleHtml?: string;
  subtitle?: string;
  bullets?: string[];
  table?: GuideTableRow[];
  chips?: { label: string; desc: string }[];
  steps?: { n: string; title: string; body: string }[];
  cta?: string;
  url?: string;
  partner?: {
    kicker: string;
    title: string;
    titleHtml?: string;
    intro: string;
    bullets?: string[];
    cta: string;
    url: string;
  };
  kind: "cover" | "content" | "cta";
};

export function buildGuidePosterPages(date: string): GuidePosterPage[] {
  const TOTAL = 8;
  const s = FPL_BEGINNER_GUIDE_SECTIONS;
  return [
    {
      kind: "cover",
      page: 1,
      total: TOTAL,
      eyebrow: "FPL BEGINNER GUIDE · 2026/27",
      title: "完整 FPL 新手上手指南",
      titleHtml: '完整 <span class="accent">FPL</span> 新手上手指南',
      subtitle: "从注册、选队、换人到积分与芯片 —— 一篇搞懂英超范特西",
      bullets: [
        "基于 fantasy.premierleague.com 官方规则整理",
        "适合从未玩过 FPL 的英超球迷",
        "收藏备用 · 左滑看完 8 页",
      ],
      cta: "完整版 → faleague-ai.com/fpl/guide",
      url: "faleague-ai.com/fpl/guide",
    },
    {
      kind: "content",
      page: 2,
      total: TOTAL,
      eyebrow: "01 · WHAT IS FPL",
      title: "FPL 是什么？",
      titleHtml: '<span class="accent">FPL</span> 是什么？',
      bullets: s[0].bullets.slice(0, 3),
      steps: [
        { n: "£100m", title: "预算", body: "选 15 名英超球员" },
        { n: "11+4", title: "每轮", body: "11 首发 + 4 替补" },
        { n: "×2", title: "队长", body: "Captain 积分翻倍" },
      ],
    },
    {
      kind: "content",
      page: 3,
      total: TOTAL,
      eyebrow: "02 · REGISTER & SQUAD",
      title: "注册 + 选 15 人",
      titleHtml: '注册 + <span class="accent">选 15 人</span>',
      bullets: [...s[1].bullets, ...s[2].bullets],
    },
    {
      kind: "content",
      page: 4,
      total: TOTAL,
      eyebrow: "03 · STARTING XI",
      title: "首发 · 队长 · 替补",
      titleHtml: '首发 · 队长 · <span class="accent">替补</span>',
      bullets: s[3].bullets,
    },
    {
      kind: "content",
      page: 5,
      total: TOTAL,
      eyebrow: "04 · DEADLINE & TRANSFERS",
      title: "Deadline 与转会",
      titleHtml: '<span class="accent">Deadline</span> 与转会',
      bullets: [...s[4].bullets, ...s[5].bullets],
    },
    {
      kind: "content",
      page: 6,
      total: TOTAL,
      eyebrow: "05 · SCORING",
      title: "积分怎么算？",
      titleHtml: '积分<span class="accent">怎么算</span>？',
      subtitle: "官方 Classic Scoring 核心项",
      table: s[6].table?.slice(0, 11),
    },
    {
      kind: "content",
      page: 7,
      total: TOTAL,
      eyebrow: "06 · CHIPS",
      title: "四枚芯片",
      titleHtml: '四枚<span class="accent">芯片</span>',
      subtitle: "每轮只能用 1 枚 · 上下半场各一套",
      chips: (s[7].table ?? []).map((r) => ({
        label: r.action,
        desc: r.points,
      })),
      bullets: s[7].bullets.slice(0, 2),
    },
    {
      kind: "cta",
      page: 8,
      total: TOTAL,
      eyebrow: "START PLAYING",
      title: "准备好上场了吗？",
      titleHtml: '准备好<span class="accent">上场</span>了吗？',
      bullets: [
        "① 注册 fantasy.premierleague.com",
        "② 按本指南选满 15 人并提交",
        "③ 每轮 Deadline 前调整首发与队长",
        "④ 来 FALEAGUE 看赛程、xP 与推荐阵容",
      ],
      cta: "打开 FALEAGUE 完整指南 →",
      url: "faleague-ai.com/fpl/guide",
      partner: {
        kicker: "PARTNER · FF SCOUT",
        title: "Fantasy Football Scout",
        titleHtml: 'Fantasy Football <span class="accent">Scout</span>',
        intro:
          "英国资深 FPL 数据与资讯平台：GW 球队新闻、球员推荐，以及 Stats Centre、Fixture Ticker 等决策工具。",
        cta: "访问 FF Scout →",
        url: "fantasyfootballscout.co.uk",
      },
    },
  ];
}

export function buildGuidePosterCaption(date: string): string {
  return [
    "📘 完整 FPL 新手上手指南（2026/27）",
    "",
    "英超官方活动纪念卡背面内容的完整版来了 ——",
    "从 0 到 1 搞懂 Fantasy Premier League：",
    "",
    "✅ FPL 是什么 · 怎么注册",
    "✅ 15 人怎么选 · 预算与同队上限",
    "✅ 首发 / 队长 / 替补自动换人",
    "✅ Deadline · 免费转会 · -4 Hit",
    "✅ 完整积分表 + 防守贡献 DC",
    "✅ Wildcard / Free Hit / BB / TC 芯片",
    "",
    "左滑 8 页看完，建议收藏备用。",
    "完整图文版（可搜索、可复制）：",
    "👉 https://faleague-ai.com/fpl/guide",
    "",
    "工具推荐：",
    "· FALEAGUE 完整指南 → faleague-ai.com/fpl/guide",
    "· 推荐阵容 → faleague-ai.com/zh/fpl/insights/recommended-squad",
    "· 阵容构建器 → faleague-ai.com/zh/squad-builder",
    "· FF Scout → fantasyfootballscout.co.uk",
    "",
    "#FPL #FantasyPremierLeague #英超 #范特西足球 #新手指南 #FPL教程 #FALEAGUE #GW1",
  ].join("\n");
}
