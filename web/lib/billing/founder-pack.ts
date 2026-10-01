/** WeChat-first Insights offer: 10 Sep–22 Oct 2026 (through GW7). */

/** List (strikethrough) prices — still the “full” SKU tags. */
export const GW_NOTE_LIST_PRICE_CNY = 19;
export const FOUNDER_PACK_LIST_PRICE_CNY = 49;

/**
 * Launch courtesy sale (限时优惠). Flip LAUNCH_DISCOUNT_ACTIVE off to restore list.
 * Charged / claimed amounts use these sale prices.
 */
export const LAUNCH_DISCOUNT_ACTIVE = true;
export const GW_NOTE_SALE_PRICE_CNY = 9.9;
export const FOUNDER_PACK_SALE_PRICE_CNY = 39.9;

/** Current ask price (sale when launch discount is on). */
export const GW_NOTE_PRICE_CNY = LAUNCH_DISCOUNT_ACTIVE
  ? GW_NOTE_SALE_PRICE_CNY
  : GW_NOTE_LIST_PRICE_CNY;
export const FOUNDER_PACK_PRICE_CNY = LAUNCH_DISCOUNT_ACTIVE
  ? FOUNDER_PACK_SALE_PRICE_CNY
  : FOUNDER_PACK_LIST_PRICE_CNY;

export const FOUNDER_PACK_THROUGH_GW = 7;
export const FOUNDER_PACK_PATH = "/pro";
/** Shopper CTAs land on the free Entry teaser, not the WeChat pay form. */
export const FOUNDER_PACK_TEASER_PATH = "/pro#teaser";
/** Session: guest already saw the PDF download gate (soft-block, once per tab). */
export const SAMPLE_PDF_GATE_SESSION_KEY = "faleague_sample_pdf_gate_v1";
/** Session: after sample PDF / signup, nudge the Entry-ID teaser on /pro. */
export const SAMPLE_TEASER_NUDGE_SESSION_KEY = "faleague_sample_teaser_nudge_v1";
export const FOUNDER_PACK_EXPIRES_AT = new Date("2026-10-22T15:59:59.000Z");

/** Public sample report asset paths (static files under /public). */
export const SAMPLE_REPORT_A_PDF_ASSET = "/pro/samples/gw5-sample-a-19.pdf";
export const SAMPLE_REPORT_B_PDF_ASSET = "/pro/samples/gw5-sample-b-49.pdf";
export const SAMPLE_REPORT_A_HTML_ASSET = "/pro/samples/gw5-sample-a-19.html";
export const SAMPLE_REPORT_B_HTML_ASSET = "/pro/samples/gw5-sample-b-49.html";

/**
 * Tracked sample links (log open/download then redirect to the asset).
 * Use these in UI / inbox / email so funnel counts stay accurate.
 */
export const SAMPLE_REPORT_A_PDF = "/api/pro/sample?sku=a&fmt=pdf";
export const SAMPLE_REPORT_B_PDF = "/api/pro/sample?sku=b&fmt=pdf";
export const SAMPLE_REPORT_A_HTML = "/api/pro/sample?sku=a&fmt=html";
export const SAMPLE_REPORT_B_HTML = "/api/pro/sample?sku=b&fmt=html";

/** Logged as event_type=pro_sample so the existing site_events check still applies. */
export const DIAGNOSE_CTA_PATH = "/pro/cta/diagnose";

export function diagnoseCtaHref(sku: ProSampleSku): string {
  return `/api/pro/diagnose?sku=${sku}`;
}

export type ProSampleSku = "a" | "b";
export type ProSampleFmt = "html" | "pdf";

export function resolveProSampleAsset(
  sku: ProSampleSku,
  fmt: ProSampleFmt,
): string {
  if (sku === "a") {
    return fmt === "pdf" ? SAMPLE_REPORT_A_PDF_ASSET : SAMPLE_REPORT_A_HTML_ASSET;
  }
  return fmt === "pdf" ? SAMPLE_REPORT_B_PDF_ASSET : SAMPLE_REPORT_B_HTML_ASSET;
}

export type FounderSkuId = "gw_note" | "founder_pack";

export function formatPriceCny(n: number): string {
  if (Number.isInteger(n)) return `¥${n}`;
  return `¥${n.toFixed(1).replace(/\.0$/, "")}`;
}

/** Integer yuan for DB columns that are still `integer` (9.9→10, 39.9→40). */
export function priceCnyToDb(n: number): number {
  return Math.round(n);
}

export const FOUNDER_SKUS: Record<
  FounderSkuId,
  {
    id: FounderSkuId;
    priceCny: number;
    listPriceCny: number;
    labelZh: string;
    labelEn: string;
  }
> = {
  gw_note: {
    id: "gw_note",
    priceCny: GW_NOTE_PRICE_CNY,
    listPriceCny: GW_NOTE_LIST_PRICE_CNY,
    labelZh: "GW诊断",
    labelEn: "GW diagnosis",
  },
  founder_pack: {
    id: "founder_pack",
    priceCny: FOUNDER_PACK_PRICE_CNY,
    listPriceCny: FOUNDER_PACK_LIST_PRICE_CNY,
    labelZh: "4轮套餐",
    labelEn: "4-GW pack",
  },
};

/**
 * Offer is live through GW7. Client components need this constant (or a
 * build-time NEXT_PUBLIC_*) — wrangler runtime vars alone are not inlined
 * into the browser bundle.
 */
export const FOUNDER_PACK_PUBLIC = true;

function envFlagTrue(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export function founderPackExpiresAt(): Date {
  return new Date(FOUNDER_PACK_EXPIRES_AT.getTime());
}

export function founderPackIsLive(now = new Date()): boolean {
  return now.getTime() < FOUNDER_PACK_EXPIRES_AT.getTime();
}

export function founderPackIsPublic(now = new Date()): boolean {
  if (!founderPackIsLive(now)) return false;
  // Explicit off switch for emergencies.
  if (
    process.env.NEXT_PUBLIC_FOUNDER_PACK_PUBLIC?.trim().toLowerCase() ===
      "false" ||
    process.env.NEXT_PUBLIC_FOUNDER_PACK_PUBLIC?.trim() === "0"
  ) {
    return false;
  }
  if (envFlagTrue("NEXT_PUBLIC_FOUNDER_PACK_PUBLIC")) return true;
  if (process.env.NODE_ENV === "development") return true;
  return FOUNDER_PACK_PUBLIC;
}

export function founderPackClaimHref(userId: string): string {
  return `/admin?tab=pro&grant=${encodeURIComponent(userId)}`;
}

export function getFounderWechatHandle(): string | null {
  const handle = process.env.NEXT_PUBLIC_WECHAT_PAY_HANDLE?.trim();
  return handle ? handle : null;
}

/** Message Ray sends in WeChat / Xiaohongshu DMs. */
export function wechatOutreachMessage(): string {
  const a = formatPriceCny(GW_NOTE_PRICE_CNY);
  const b = formatPriceCny(FOUNDER_PACK_PRICE_CNY);
  const discount = LAUNCH_DISCOUNT_ACTIVE ? "（限时优惠）" : "";
  return [
    "Faleague 阵容诊断已开：",
    `A. 本轮 GW诊断 ${a}${discount}（原价 ¥${GW_NOTE_LIST_PRICE_CNY}；微信发你一份，含小联赛 + MOTW）`,
    `B. 创始人套餐 ${b}${discount}（原价 ¥${FOUNDER_PACK_LIST_PRICE_CNY}）用到第7轮（10月22日）：每轮诊断 + Insights Pro + 小联赛大杀器`,
    "怎么买：1）faleague-ai.com 注册  2）打开 /pro 先免费诊断  3）需要完整报告再留微信号，我加你私下收款。站内不放收款码。",
    "Scout 中文继续免费，这不是 Scout 会员替代。",
  ].join("\n");
}

/** Caption line for original Faleague GW posts (not Scout-attributed). */
export function founderPackPostCta(): string {
  const a = formatPriceCny(GW_NOTE_PRICE_CNY);
  const b = formatPriceCny(FOUNDER_PACK_PRICE_CNY);
  const tag = LAUNCH_DISCOUNT_ACTIVE ? "限时优惠 " : "";
  return `先免费诊断：打开 /pro 输入 Entry。完整报告再留微信号。${tag}${a} 单轮 / ${b} 用到第7轮。`;
}
