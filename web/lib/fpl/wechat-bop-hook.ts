import {
  BEST_OF_POSITION_HUB_HREF,
  VALUE_BAND_PRESETS,
  formatValueBandRange,
  getValueBandPreset,
  listValueBandsByPosition,
  loadValueBandByPreset,
  type ValueBandAnalysis,
  type ValueBandPosition,
  type ValueBandPreset,
  type ValueBandTakeaway,
  type ValueBandCategoryTop,
  VALUE_BAND_MIN_PRIOR_MINUTES,
  hasReliablePriorMinutes,
} from "@/lib/fpl/insights/value-bands";
import {
  resolveWechatCardSiteUrl,
  shanghaiDateIso,
} from "@/lib/fpl/wechat-daily-card";

const POS_ZH: Record<ValueBandPosition, string> = {
  GKP: "门将",
  DEF: "后卫",
  MID: "中场",
  FWD: "前锋",
};

export type WechatBopHookData = {
  card_date: string;
  band_id: string;
  position: ValueBandPosition;
  price: string;
  position_zh: string;
  title_zh: string;
  assessed: number;
  horizon: number;
  takeaways: ValueBandTakeaway[];
  category_tops: ValueBandCategoryTop[];
  /** Prior-minutes floor used for poster / highlight reliability. */
  minutes_floor: number;
  top_player: string | null;
  top_xp: number | null;
  siblings: Array<{ id: string; label: string; href: string }>;
  band_url: string;
  hub_url: string;
  /** Full WeChat group / Moments-ready copy. */
  text_full: string;
  /** One-liner hook for stories / short posts. */
  text_short: string;
};

function localePath(locale: "zh" | "en"): string {
  return locale === "zh" ? "zh" : "en";
}

/** Rotate featured band by Shanghai calendar day (stable daily spotlight). */
export function pickDailyBopBandId(asOf = new Date()): string {
  const iso = shanghaiDateIso(asOf);
  const dayNum = Number(iso.replaceAll("-", ""));
  const idx = Math.abs(dayNum) % VALUE_BAND_PRESETS.length;
  return VALUE_BAND_PRESETS[idx]!.id;
}

function siblingBands(preset: ValueBandPreset, max = 3): ValueBandPreset[] {
  const same = listValueBandsByPosition(preset.position).filter(
    (p) => p.id !== preset.id,
  );
  // Prefer nearby prices first.
  return [...same]
    .sort(
      (a, b) =>
        Math.abs(a.minPrice - preset.minPrice) -
        Math.abs(b.minPrice - preset.minPrice),
    )
    .slice(0, max);
}

function discussionPrompt(data: {
  position_zh: string;
  price: string;
  top_player: string | null;
}): string {
  if (data.top_player) {
    return `£${data.price}m ${data.position_zh}你会选 ${data.top_player}，还是另有冷门？留言说说你的理由。`;
  }
  return `组队时这个 £${data.price}m ${data.position_zh}价位，你会留给谁？`;
}

export function formatWechatBopHookFull(hook: Omit<
  WechatBopHookData,
  "text_full" | "text_short"
>): string {
  const lines: string[] = [
    `🎯 位置精选 · Best of Position`,
    `📅 ${hook.card_date}`,
    "",
    `今日钩子：最佳 £${hook.price}m ${hook.position_zh}`,
    `我们评估了 ${hook.assessed} 名该价位球员（未来 ${hook.horizon} 轮 xP）。`,
    "",
  ];

  if (hook.takeaways.length) {
    lines.push("📌 今日看点");
    for (const t of hook.takeaways) {
      lines.push(`• ${t.blurb_zh}`);
    }
    lines.push(
      `※ 出场门槛：上季 ≥${hook.minutes_floor} 分钟优先（不足时补位填满榜单）`,
    );
    lines.push("");
  } else if (hook.top_player && hook.top_xp != null) {
    lines.push(
      `📌 领跑：${hook.top_player}（投影 xP ${hook.top_xp.toFixed(1)}）`,
    );
    lines.push("");
  }

  if (hook.siblings.length) {
    lines.push("🔁 同系列接着逛");
    for (const s of hook.siblings) {
      lines.push(`• ${s.label}`);
    }
    lines.push("");
  }

  lines.push(`💬 ${discussionPrompt(hook)}`);
  lines.push("");
  lines.push(`🔗 打开本页：${hook.band_url}`);
  lines.push(`📚 全部价位：${hook.hub_url}`);
  lines.push("");
  lines.push("回来 faleague-ai.com，把预算花在刀刃上。");

  return lines.join("\n").trimEnd();
}

export function formatWechatBopHookShort(hook: Omit<
  WechatBopHookData,
  "text_full" | "text_short"
>): string {
  const lead =
    hook.takeaways[0]?.blurb_zh ??
    (hook.top_player && hook.top_xp != null
      ? `${hook.top_player} 以 xP ${hook.top_xp.toFixed(1)} 领跑`
      : `已评估 ${hook.assessed} 人`);
  return [
    `🎯 最佳 £${hook.price}m ${hook.position_zh}｜${lead}`,
    `完整排名 → ${hook.band_url}`,
    `系列导航 → ${hook.hub_url}`,
  ].join("\n");
}

export async function buildWechatBopHook(opts?: {
  bandId?: string;
  locale?: "zh" | "en";
  asOf?: Date;
}): Promise<WechatBopHookData> {
  const locale = opts?.locale ?? "zh";
  const asOf = opts?.asOf ?? new Date();
  const cardDate = shanghaiDateIso(asOf);
  const bandId = opts?.bandId ?? pickDailyBopBandId(asOf);
  const preset = getValueBandPreset(bandId);
  if (!preset) {
    throw new Error(`Unknown Best of Position band: ${bandId}`);
  }

  const analysis: ValueBandAnalysis = await loadValueBandByPreset(preset);
  const price = formatValueBandRange(preset.minPrice, preset.maxPrice);
  const positionZh = POS_ZH[preset.position];
  const site = resolveWechatCardSiteUrl();
  const base = `${site}/${localePath(locale)}`;
  const bandUrl = `${base}${preset.href}`;
  const hubUrl = `${base}${BEST_OF_POSITION_HUB_HREF}`;

  const xpCatTop = analysis.category_tops.find((c) => c.kind === "xp")
    ?.players[0];
  const topRow =
    analysis.rows.find(hasReliablePriorMinutes) ?? analysis.rows[0] ?? null;
  const topPlayer = xpCatTop?.web_name ?? topRow?.web_name ?? null;
  const topXp = xpCatTop?.value ?? topRow?.xp_total ?? null;
  const siblings = siblingBands(preset).map((p) => ({
    id: p.id,
    label: `£${formatValueBandRange(p.minPrice, p.maxPrice)}m ${POS_ZH[p.position]}`,
    href: `${base}${p.href}`,
  }));

  const core = {
    card_date: cardDate,
    band_id: preset.id,
    position: preset.position,
    price,
    position_zh: positionZh,
    title_zh: `最佳 £${price}m ${positionZh}`,
    assessed: analysis.assessed,
    horizon: analysis.horizon,
    takeaways: analysis.takeaways,
    category_tops: analysis.category_tops,
    minutes_floor: VALUE_BAND_MIN_PRIOR_MINUTES,
    top_player: topPlayer,
    top_xp: topXp,
    siblings,
    band_url: bandUrl,
    hub_url: hubUrl,
  };

  return {
    ...core,
    text_full: formatWechatBopHookFull(core),
    text_short: formatWechatBopHookShort(core),
  };
}
