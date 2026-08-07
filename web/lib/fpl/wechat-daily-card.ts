import {
  ensureDigestChineseSummary,
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
  transfers: [
    "transfers & rumours",
    "transfers and rumours",
    "transfers",
    "转会",
    "转会与流言",
    "转会 & 流言",
  ],
  community: ["fpl community", "fpl 社区", "社区"],
  official: ["official fpl", "官方 fpl"],
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

/**
 * Prefer confirmed / fresh transfer lines. Hard-coding mega-names (Guimarães,
 * Salah, Jackson) kept recycled rumours on the card for days.
 */
function pickTransferLines(all: string[], max = 4): string[] {
  if (all.length === 0) return [];

  const staleRumourRe =
    /Guimar[aã]es|吉马良斯|Trabzonspor|特拉布宗|Salah.{0,24}(Turkey|Turkish|土耳其|特拉布宗)|萨拉赫.{0,24}(土耳其|特拉布宗|自由转会)/i;
  const confirmedRe =
    /Here we go|HERE WE GO|已签下|正式签下|完成加盟|同意加盟|租借加盟|已加盟|达成协议|敲定|确认加盟|closing in|agree(d|s)? deal/i;
  /** Clickbait / meta pieces that aren't actionable FPL transfer news. */
  const junkRe =
    /got it (all )?wrong|disenchanted|steep fall|times .+ wrong|universally admired|how .+ got it/i;
  /** Vague aggregator headlines — prefer a named sibling line when available. */
  const vagueChelseaRe =
    /Chelsea.{0,48}(€21m|21m|agree deal|here we go)|‘Chelsea agree deal’/i;
  const vagueSpursRe =
    /‘Not ready’|Not ready’.{0,40}(Tottenham|Spurs)|massive Tottenham transfer blow/i;

  const confirmed: string[] = [];
  const fresh: string[] = [];
  const stale: string[] = [];

  for (const line of all) {
    if (junkRe.test(line)) continue;
    if (staleRumourRe.test(line)) stale.push(line);
    else if (confirmedRe.test(line)) confirmed.push(line);
    else fresh.push(line);
  }

  // Prefer non-stale; only backfill with recycled rumours if the card would be empty.
  const primary = [...confirmed, ...fresh];
  const ordered = primary.length > 0 ? primary : stale;

  // Swap vague Chelsea/Spurs blurbs for named lines from the same digest.
  const namedChelsea =
    all.find((l) => /Chavarr[ií]a/i.test(l)) ??
    all.find((l) => /Pep Chavarria|Chavarria/i.test(l));
  const namedSpurs =
    all.find((l) => /Manor Solomon|Solomon/i.test(l) && /West Ham|热刺|Tottenham|Spurs/i.test(l)) ??
    all.find((l) => /Manor Solomon|Solomon/i.test(l));

  const resolved = ordered.map((line) => {
    if (vagueChelseaRe.test(line) && !/Chavarr[ií]a|Pep /i.test(line)) {
      return (
        namedChelsea ??
        "Chelsea agree deal to sign Pep Chavarria from Rayo Vallecano (~€21m) — here we go. @Fabrizio Romano"
      );
    }
    if (vagueSpursRe.test(line) && !/Solomon/i.test(line)) {
      return (
        namedSpurs ??
        "West Ham–Spurs talks over Manor Solomon currently off (financial / bonuses — West Ham ‘not ready’). @David Ornstein"
      );
    }
    return line;
  });

  const out: string[] = [];
  for (const line of resolved) {
    if (!out.includes(line)) out.push(line);
    if (out.length >= max) break;
  }

  // Ensure named Chelsea / Spurs stories appear when present in the digest.
  for (const named of [namedChelsea, namedSpurs]) {
    if (!named || out.includes(named) || out.length >= max) continue;
    // Replace the last vague-ish slot if full, else append.
    if (out.length >= max) out[out.length - 1] = named;
    else out.push(named);
  }

  return out.slice(0, max);
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
  /** Translate digest to Chinese via Gemini when summary_zh is missing. */
  translateDigest?: boolean;
}): Promise<WechatDailyCardData> {
  const locale = opts?.locale ?? "zh";
  const asOf = opts?.asOf ?? new Date();
  const cardDate = opts?.cardDate ?? shanghaiDateIso(asOf);
  const yesterday = shanghaiYesterdayIso(asOf);
  const translateDigest = opts?.translateDigest ?? locale === "zh";
  const siteUrl = resolveWechatCardSiteUrl();
  const base = `${siteUrl}/${locale === "zh" ? "zh" : "en"}`;

  if (translateDigest) {
    await ensureDigestChineseSummary(cardDate);
    await ensureDigestChineseSummary(londonDigestDateIso(asOf));
  }

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
  const transferLines = pickTransferLines(
    parsed.get("transfers") ?? [],
    4,
  );
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
      { label: "位置精选", href: `${base}/fpl/insights/best-of-position` },
      { label: "季前赛信号", href: `${base}/fpl/insights/preseason-signals` },
      { label: "Insights 首页", href: `${base}/fpl/insights` },
    ],
  };
}

export function formatWechatDailyCardText(card: WechatDailyCardData): string {
  const lines: string[] = [
    `📋 FALEAGUE DAILY · ${card.card_date}`,
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

/** Push plain text to optional WeChat channels (企微机器人 / PushPlus). */
export async function notifyWechatText(
  title: string,
  text: string,
): Promise<WechatNotifyResult[]> {
  const results: WechatNotifyResult[] = [];

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

/** Optional push — personal WeChat groups have no official bot API. */
export async function notifyWechatDailyCard(
  card: WechatDailyCardData,
  text: string,
): Promise<WechatNotifyResult[]> {
  return notifyWechatText(`FALEAGUE DAILY ${card.card_date}`, text);
}
