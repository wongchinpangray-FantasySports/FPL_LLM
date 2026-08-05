import {
  loadFplXDigestFromDb,
  londonDigestDateIso,
  pickDigestSummary,
  type FplXDigestRecord,
} from "@/lib/fpl/fpl-x-digest";
import {
  loadPreseasonSignalsForMatchDate,
  type PreseasonMatchSummary,
  type PreseasonSignalRow,
} from "@/lib/fpl/insights/preseason-signals";

export const WECHAT_CARD_TZ = "Asia/Shanghai";

export type WechatDailyCardSection = {
  title: string;
  lines: string[];
};

export type WechatDailyCardData = {
  /** Calendar date in Asia/Shanghai (YYYY-MM-DD). */
  card_date: string;
  site_url: string;
  digest: FplXDigestRecord | null;
  sections: WechatDailyCardSection[];
  preseason_yesterday: PreseasonSignalRow[];
  preseason_match_date: string | null;
  preseason_match_count: number;
  discussion_prompt: string;
  links: { label: string; href: string }[];
};

const SECTION_ALIASES: Record<string, string[]> = {
  injuries: [
    "injuries & team news",
    "injuries and team news",
    "伤病",
    "伤病与球队新闻",
    "伤病 & 球队新闻",
  ],
  transfers: ["transfers & rumours", "transfers and rumours", "转会", "转会与流言"],
  community: ["fpl community", "fpl 社区", "社区"],
};

function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function sectionKey(heading: string): string | null {
  const norm = normalizeHeading(heading);
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.some((a) => norm.includes(normalizeHeading(a)))) return key;
  }
  return null;
}

/** Today in Asia/Shanghai (YYYY-MM-DD). */
export function shanghaiDateIso(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WECHAT_CARD_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Yesterday in Asia/Shanghai (YYYY-MM-DD). */
export function shanghaiYesterdayIso(date = new Date()): string {
  const today = shanghaiDateIso(date);
  const [y, m, d] = today.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() - 1);
  return shanghaiDateIso(anchor);
}

export function formatShanghaiShortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}月${d}日`;
}

/** Parse markdown digest body into named sections. */
export function parseDigestSections(summary: string): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let currentKey: string | null = null;

  for (const raw of summary.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^##\s+(.+)/);
    if (heading) {
      currentKey = sectionKey(heading[1]) ?? normalizeHeading(heading[1]);
      if (!sections.has(currentKey)) sections.set(currentKey, []);
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)/);
    if (bullet && currentKey) {
      const list = sections.get(currentKey) ?? [];
      list.push(bullet[1].trim());
      sections.set(currentKey, list);
    }
  }

  return sections;
}

function takeBullets(map: Map<string, string[]>, key: string, max: number): string[] {
  return (map.get(key) ?? []).slice(0, max);
}

function formatPreseasonRow(row: PreseasonSignalRow): string {
  const parts: string[] = [];
  if (row.goals > 0) parts.push(`${row.goals}球`);
  if (row.assists > 0) parts.push(`${row.assists}助`);
  if (row.starts > 0) parts.push(`${row.starts}首发`);
  else if (row.sub_appearances > 0) parts.push(`${row.sub_appearances}替补`);
  const stat = parts.length ? parts.join(" · ") : "有出场";
  const club = row.pl_name || row.pl_code;
  const fpl = row.fpl_id != null ? " ✓FPL" : "";
  return `${row.name}（${club}）— ${stat}${fpl}`;
}

function formatMatchResult(match: PreseasonMatchSummary): string {
  return `${match.pl_name} ${match.pl_goals}-${match.opp_goals} ${match.opponent}`;
}

function pickDiscussionPrompt(
  preseason: PreseasonSignalRow[],
  injuryLines: string[],
): string {
  const pick =
    preseason.find((r) => r.fpl_id != null && (r.goals > 0 || r.starts >= 2)) ??
    preseason[0];
  if (pick) {
    if (pick.goals >= 2) {
      return `昨日季前赛 ${pick.goals} 球的 ${pick.name} — 你会为 GW1 选他吗？`;
    }
    if (pick.starts >= 2) {
      return `${pick.name} 连续首发 — 你会提前把他排进 GW1 阵容吗？`;
    }
    return `${pick.name} 昨日表现不错 — 你会考虑 GW1 入手吗？`;
  }
  if (injuryLines.length) {
    return "今日伤病/转会消息里，哪一条最影响你的 GW1 计划？";
  }
  return "新赛季临近 — 你的 GW1 模板队里最大胆的一签是谁？";
}

export function resolveWechatCardSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.faleague-ai.com"
  );
}

export async function buildWechatDailyCard(opts?: {
  /** Card calendar date in Asia/Shanghai (defaults to today). */
  cardDate?: string;
  locale?: "zh" | "en";
  asOf?: Date;
}): Promise<WechatDailyCardData> {
  const locale = opts?.locale ?? "zh";
  const asOf = opts?.asOf ?? new Date();
  const cardDate = opts?.cardDate ?? shanghaiDateIso(asOf);
  const yesterday = shanghaiYesterdayIso(asOf);
  const siteUrl = resolveWechatCardSiteUrl();
  const base = `${siteUrl}/${locale === "zh" ? "zh" : "en"}`;

  const [digestPrimary, preseasonDay] = await Promise.all([
    loadFplXDigestFromDb(cardDate),
    loadPreseasonSignalsForMatchDate(yesterday).catch(() => ({
      rows: [] as PreseasonSignalRow[],
      match_date: yesterday,
      match_count: 0,
      matches: [] as PreseasonMatchSummary[],
      season: "",
      updated_at: "",
    })),
  ]);

  let digest = digestPrimary;
  if (!digest) {
    digest = await loadFplXDigestFromDb(londonDigestDateIso(asOf));
  }

  const summary =
    digest != null ? pickDigestSummary(digest, locale) : "";
  const parsed = parseDigestSections(summary);

  const injuryLines = takeBullets(parsed, "injuries", 4);
  const transferLines = takeBullets(parsed, "transfers", 3);
  const communityLines = takeBullets(parsed, "community", 2);

  const sections: WechatDailyCardSection[] = [];

  if (injuryLines.length) {
    sections.push({ title: "🏥 伤病 & 球队新闻", lines: injuryLines });
  }
  if (transferLines.length) {
    sections.push({ title: "🔄 转会 & 流言", lines: transferLines });
  }
  if (communityLines.length) {
    sections.push({ title: "💬 FPL 社区", lines: communityLines });
  }

  const preseasonTop = preseasonDay.rows.slice(0, 5);
  if (preseasonDay.match_count > 0) {
    const dateLabel = formatShanghaiShortDate(preseasonDay.match_date);
    const lines = [
      ...preseasonDay.matches.map(formatMatchResult),
      ...preseasonTop.map(formatPreseasonRow),
    ];
    sections.push({
      title: `⚽ 昨日季前赛（${dateLabel} · ${preseasonDay.match_count} 场）`,
      lines,
    });
  }

  return {
    card_date: cardDate,
    site_url: siteUrl,
    digest,
    sections,
    preseason_yesterday: preseasonTop,
    preseason_match_date:
      preseasonDay.match_count > 0 ? preseasonDay.match_date : null,
    preseason_match_count: preseasonDay.match_count,
    discussion_prompt: pickDiscussionPrompt(preseasonTop, injuryLines),
    links: [
      { label: "完整 FPL 简报", href: `${base}/news/fpl-daily` },
      { label: "季前赛信号", href: `${base}/fpl/insights/preseason-signals` },
      { label: "Insights 首页", href: `${base}/fpl/insights` },
    ],
  };
}

export function formatWechatDailyCardText(card: WechatDailyCardData): string {
  const lines: string[] = [
    `📋 FPL 每日卡片 · ${card.card_date}`,
    "",
  ];

  const hasDigest =
    card.digest != null &&
    Boolean(card.digest.summary_zh || card.digest.summary_en);
  const hasNewsSections = card.sections.some((s) =>
    /伤病|转会|社区/.test(s.title),
  );

  if (!hasDigest) {
    lines.push("ℹ️ 今日简报尚未生成 — 请稍后再看或打开网站。");
    lines.push("");
  } else if (!hasNewsSections) {
    lines.push("ℹ️ 过去 48 小时暂无重要伤病/转会/社区动态。");
    lines.push("");
  }

  for (const section of card.sections) {
    lines.push(section.title);
    for (const line of section.lines) {
      lines.push(`• ${line}`);
    }
    lines.push("");
  }

  lines.push(`💬 今日讨论：${card.discussion_prompt}`);
  lines.push("");
  lines.push("🔗 链接");
  for (const link of card.links) {
    lines.push(`${link.label}：${link.href}`);
  }

  return lines.join("\n").trimEnd();
}

export type WechatNotifyResult = {
  channel: "wechat_work" | "pushplus" | "none";
  ok: boolean;
  detail?: string;
};

/** Optional push — personal WeChat groups have no official bot API. */
export async function notifyWechatDailyCard(
  card: WechatDailyCardData,
  text: string,
): Promise<WechatNotifyResult[]> {
  const results: WechatNotifyResult[] = [];
  const title = `FPL 每日卡片 ${card.card_date}`;

  const workUrl = process.env.WECHAT_WORK_WEBHOOK_URL?.trim();
  if (workUrl) {
    try {
      const res = await fetch(workUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msgtype: "markdown",
          markdown: { content: text.replace(/\n/g, "\n\n") },
        }),
      });
      const body = await res.text();
      results.push({
        channel: "wechat_work",
        ok: res.ok,
        detail: body.slice(0, 200),
      });
    } catch (e) {
      results.push({
        channel: "wechat_work",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const pushToken = process.env.PUSHPLUS_TOKEN?.trim();
  if (pushToken) {
    try {
      const res = await fetch("https://www.pushplus.plus/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: pushToken,
          title,
          content: text.replace(/\n/g, "<br/>"),
          template: "html",
        }),
      });
      const json = (await res.json()) as { code?: number; msg?: string };
      results.push({
        channel: "pushplus",
        ok: res.ok && json.code === 200,
        detail: json.msg,
      });
    } catch (e) {
      results.push({
        channel: "pushplus",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (!results.length) {
    results.push({ channel: "none", ok: true });
  }

  return results;
}
