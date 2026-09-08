/**
 * Buy / Hold / Sell stance from form, upcoming FDR, and next-GW xP.
 * Simple additive signals so the label stays explainable on pitch + profile.
 */

export type TransferStance = "buy" | "hold" | "sell";

export type TransferStanceInput = {
  form: number | null | undefined;
  /** Average FDR over the next few fixtures (1 easy … 5 hard). */
  avgFdr: number | null | undefined;
  /** Next single-GW expected points (uncaptained). */
  xpNext: number | null | undefined;
  position?: string | null;
};

export type TransferStanceReason =
  | "form_hot"
  | "form_cold"
  | "fdr_easy"
  | "fdr_hard"
  | "xp_high"
  | "xp_low";

export type TransferStanceResult = {
  stance: TransferStance;
  /** Sum of −1 / 0 / +1 signals; buy ≥ 2, sell ≤ −2. */
  score: number;
  reasons: TransferStanceReason[];
};

function xpBuyThreshold(position: string | null | undefined): number {
  const pos = (position ?? "").toUpperCase();
  if (pos === "GKP" || pos === "DEF") return 3.8;
  return 4.5;
}

function xpSellThreshold(position: string | null | undefined): number {
  const pos = (position ?? "").toUpperCase();
  if (pos === "GKP" || pos === "DEF") return 2.2;
  return 2.6;
}

/**
 * Classify a player for transfer urgency.
 * Unavailable/injured callers should still pass numbers; UI can overlay attention separately.
 */
export function classifyTransferStance(
  input: TransferStanceInput,
): TransferStanceResult {
  const reasons: TransferStanceReason[] = [];
  let score = 0;

  const form =
    input.form != null && Number.isFinite(input.form) ? Number(input.form) : null;
  if (form != null) {
    if (form >= 5) {
      score += 1;
      reasons.push("form_hot");
    } else if (form <= 2.5) {
      score -= 1;
      reasons.push("form_cold");
    }
  }

  const fdr =
    input.avgFdr != null && Number.isFinite(input.avgFdr)
      ? Number(input.avgFdr)
      : null;
  if (fdr != null) {
    if (fdr <= 2.5) {
      score += 1;
      reasons.push("fdr_easy");
    } else if (fdr >= 4) {
      score -= 1;
      reasons.push("fdr_hard");
    }
  }

  const xp =
    input.xpNext != null && Number.isFinite(input.xpNext)
      ? Number(input.xpNext)
      : null;
  if (xp != null) {
    if (xp >= xpBuyThreshold(input.position)) {
      score += 1;
      reasons.push("xp_high");
    } else if (xp <= xpSellThreshold(input.position)) {
      score -= 1;
      reasons.push("xp_low");
    }
  }

  let stance: TransferStance = "hold";
  if (score >= 2) stance = "buy";
  else if (score <= -2) stance = "sell";

  return { stance, score, reasons };
}

/** Mean FDR from strip cells (skips nulls). */
export function averageFdr(
  cells: Array<{ fdr: number | null | undefined }> | null | undefined,
): number | null {
  if (!cells?.length) return null;
  const vals = cells
    .map((c) => c.fdr)
    .filter((n): n is number => n != null && Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
