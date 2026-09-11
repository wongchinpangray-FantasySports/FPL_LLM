import { FOUNDER_SKUS } from "@/lib/billing/founder-pack";

export const PRO_SUB_STATUSES = [
  "lead",
  "contacted",
  "paid",
  "fulfilled",
  "lost",
] as const;

export type ProSubStatus = (typeof PRO_SUB_STATUSES)[number];

export const PRO_SUB_SKUS = [
  "gw_note",
  "founder_pack",
  "addon",
  "other",
] as const;

export type ProSubSku = (typeof PRO_SUB_SKUS)[number];

export const PRO_SUB_SOURCES = [
  "pro_claim",
  "manual",
  "wechat_dm",
  "xhs",
  "other",
] as const;

export type ProSubSource = (typeof PRO_SUB_SOURCES)[number];

export type ProSubscriptionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  wechat_id: string;
  email: string;
  user_id: string | null;
  needs_signup: boolean;
  sku: ProSubSku;
  price_cny: number;
  amount_collected_cny: number | null;
  status: ProSubStatus;
  notes: string | null;
  gameweek: number | null;
  notes_delivered: number;
  expires_at: string | null;
  contacted_at: string | null;
  paid_at: string | null;
  fulfilled_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  source: ProSubSource;
};

export type ProSubProgress = {
  total: number;
  byStatus: Record<ProSubStatus, number>;
  payers: number;
  yenCollected: number;
  yenPipeline: number;
  leads7d: number;
  paid7d: number;
};

export function defaultPriceForSku(sku: ProSubSku): number {
  if (sku === "gw_note") return FOUNDER_SKUS.gw_note.priceCny;
  if (sku === "founder_pack") return FOUNDER_SKUS.founder_pack.priceCny;
  return 0;
}

/** Rounded yuan for integer DB columns. */
export function defaultPriceCnyDb(sku: ProSubSku): number {
  return Math.round(defaultPriceForSku(sku));
}

export function skuLabelZh(sku: ProSubSku): string {
  if (sku === "gw_note") return FOUNDER_SKUS.gw_note.labelZh;
  if (sku === "founder_pack") return FOUNDER_SKUS.founder_pack.labelZh;
  if (sku === "addon") return "加项";
  return "其他";
}
