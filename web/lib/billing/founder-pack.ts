/** WeChat-first Insights offer: 10 Sep–22 Oct 2026 (through GW7). */

export const GW_NOTE_PRICE_CNY = 19;
export const FOUNDER_PACK_PRICE_CNY = 49;
export const FOUNDER_PACK_THROUGH_GW = 7;
export const FOUNDER_PACK_PATH = "/pro";
export const FOUNDER_PACK_EXPIRES_AT = new Date("2026-10-22T15:59:59.000Z");

/** Public sample PDFs under /pro (reference downloads). */
export const SAMPLE_REPORT_A_PDF = "/pro/samples/gw4-sample-a-19.pdf";
export const SAMPLE_REPORT_B_PDF = "/pro/samples/gw4-sample-b-49.pdf";

export type FounderSkuId = "gw_note" | "founder_pack";

export const FOUNDER_SKUS: Record<
  FounderSkuId,
  { id: FounderSkuId; priceCny: number; labelZh: string; labelEn: string }
> = {
  gw_note: {
    id: "gw_note",
    priceCny: GW_NOTE_PRICE_CNY,
    labelZh: "GW诊断",
    labelEn: "GW diagnosis",
  },
  founder_pack: {
    id: "founder_pack",
    priceCny: FOUNDER_PACK_PRICE_CNY,
    labelZh: "4轮套餐",
    labelEn: "4-GW pack",
  },
};

/**
 * Hard kill-switch for production deploys. Prefer env
 * NEXT_PUBLIC_FOUNDER_PACK_PUBLIC=true when going live.
 * Local `next dev` always shows the offer for preview.
 */
export const FOUNDER_PACK_PUBLIC = false;

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
  if (envFlagTrue("NEXT_PUBLIC_FOUNDER_PACK_PUBLIC")) return true;
  // Localhost preview without flipping production.
  if (process.env.NODE_ENV === "development") return true;
  return FOUNDER_PACK_PUBLIC;
}

export function founderPackClaimHref(userId: string): string {
  return `/admin?grant=${encodeURIComponent(userId)}`;
}

export function getFounderWechatHandle(): string | null {
  const handle = process.env.NEXT_PUBLIC_WECHAT_PAY_HANDLE?.trim();
  return handle ? handle : null;
}

/** Message Ray sends in WeChat / Xiaohongshu DMs. */
export function wechatOutreachMessage(): string {
  return [
    "Faleague 阵容诊断已开：",
    "A. 本轮 GW诊断 ¥19（微信发你一份，含小联赛 + MOTW）",
    "B. 创始人套餐 ¥49 用到第7轮（10月22日）：每轮诊断 + Insights Pro + 小联赛大杀器",
    "怎么买：1）faleague-ai.com 注册  2）打开 /pro 留下微信号  3）我加你微信，私下收款后开通。站内不放收款码。",
    "Scout 中文继续免费，这不是 Scout 会员替代。",
  ].join("\n");
}

/** Caption line for original Faleague GW posts (not Scout-attributed). */
export function founderPackPostCta(): string {
  return "针对你自己阵容的转会建议：/pro 留微信号，我加你开通。¥19 单轮 / ¥49 用到第7轮。";
}
