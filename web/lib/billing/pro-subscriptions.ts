import {
  type FounderSkuId,
  founderPackExpiresAt,
} from "@/lib/billing/founder-pack";
import {
  defaultPriceForSku,
  defaultPriceCnyDb,
  type ProSubProgress,
  type ProSubSku,
  type ProSubSource,
  type ProSubStatus,
  type ProSubscriptionRow,
  PRO_SUB_STATUSES,
  PRO_SUB_SKUS,
  PRO_SUB_SOURCES,
  skuLabelZh,
} from "@/lib/billing/pro-subscriptions-shared";
import { getServerSupabase } from "@/lib/supabase";
import { grantInsightsPremium } from "@/lib/stripe/insights-billing";

export {
  PRO_SUB_STATUSES,
  PRO_SUB_SKUS,
  PRO_SUB_SOURCES,
  defaultPriceForSku,
  defaultPriceCnyDb,
  skuLabelZh,
};
export type {
  ProSubStatus,
  ProSubSku,
  ProSubSource,
  ProSubscriptionRow,
  ProSubProgress,
};

function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const msg = String(err.message ?? "").toLowerCase();
  return msg.includes("pro_subscriptions") && msg.includes("does not exist");
}

type ClaimInput = {
  wechatId: string;
  email: string;
  userId?: string | null;
  needsSignup: boolean;
  sku: FounderSkuId;
};

/** Skip insert if same wechat+sku lead in last 24h. */
export async function recordProClaim(
  input: ClaimInput,
): Promise<{ row: ProSubscriptionRow | null; tableMissing: boolean; duplicate: boolean }> {
  const admin = getServerSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: findErr } = await admin
    .from("pro_subscriptions")
    .select("*")
    .eq("wechat_id", input.wechatId)
    .eq("sku", input.sku)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);

  if (findErr && isMissingTable(findErr)) {
    return { row: null, tableMissing: true, duplicate: false };
  }
  if (findErr) throw new Error(findErr.message);

  if (existing && existing.length > 0) {
    return {
      row: existing[0] as ProSubscriptionRow,
      tableMissing: false,
      duplicate: true,
    };
  }

  const price = defaultPriceCnyDb(input.sku);
  const { data, error } = await admin
    .from("pro_subscriptions")
    .insert({
      wechat_id: input.wechatId,
      email: input.email.toLowerCase(),
      user_id: input.userId ?? null,
      needs_signup: input.needsSignup,
      sku: input.sku,
      price_cny: price,
      status: "lead",
      source: "pro_claim",
      expires_at:
        input.sku === "founder_pack"
          ? founderPackExpiresAt().toISOString()
          : null,
    })
    .select("*")
    .single();

  if (error && isMissingTable(error)) {
    return { row: null, tableMissing: true, duplicate: false };
  }
  if (error) throw new Error(error.message);
  return {
    row: data as ProSubscriptionRow,
    tableMissing: false,
    duplicate: false,
  };
}

export async function listProSubscriptions(): Promise<{
  rows: ProSubscriptionRow[];
  progress: ProSubProgress;
  tableMissing: boolean;
}> {
  const admin = getServerSupabase();
  const { data, error } = await admin
    .from("pro_subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error && isMissingTable(error)) {
    return {
      rows: [],
      progress: emptyProgress(),
      tableMissing: true,
    };
  }
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ProSubscriptionRow[];
  return { rows, progress: computeProgress(rows), tableMissing: false };
}

function emptyProgress(): ProSubProgress {
  return {
    total: 0,
    byStatus: {
      lead: 0,
      contacted: 0,
      paid: 0,
      fulfilled: 0,
      lost: 0,
    },
    payers: 0,
    yenCollected: 0,
    yenPipeline: 0,
    leads7d: 0,
    paid7d: 0,
  };
}

export function computeProgress(rows: ProSubscriptionRow[]): ProSubProgress {
  const progress = emptyProgress();
  progress.total = rows.length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    progress.byStatus[row.status] += 1;
    const created = Date.parse(row.created_at);
    if (!Number.isNaN(created) && created >= weekAgo) progress.leads7d += 1;

    if (row.status === "paid" || row.status === "fulfilled") {
      progress.payers += 1;
      const yen = row.amount_collected_cny ?? row.price_cny;
      progress.yenCollected += yen;
      const paidAt = row.paid_at ? Date.parse(row.paid_at) : created;
      if (!Number.isNaN(paidAt) && paidAt >= weekAgo) progress.paid7d += 1;
    } else if (row.status === "lead" || row.status === "contacted") {
      progress.yenPipeline += row.price_cny;
    }
  }
  return progress;
}

export type ProSubPatch = {
  status?: ProSubStatus;
  notes?: string | null;
  amount_collected_cny?: number | null;
  notes_delivered?: number;
  gameweek?: number | null;
  user_id?: string | null;
  lost_reason?: string | null;
  grantPremium?: boolean;
};

export async function updateProSubscription(
  id: string,
  patch: ProSubPatch,
): Promise<{ row: ProSubscriptionRow; tableMissing: boolean }> {
  const admin = getServerSupabase();
  const { data: current, error: curErr } = await admin
    .from("pro_subscriptions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (curErr && isMissingTable(curErr)) {
    return { row: null as unknown as ProSubscriptionRow, tableMissing: true };
  }
  if (curErr) throw new Error(curErr.message);
  if (!current) throw Object.assign(new Error("Not found"), { status: 404 });

  const row = current as ProSubscriptionRow;
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.amount_collected_cny !== undefined) {
    update.amount_collected_cny = patch.amount_collected_cny;
  }
  if (patch.notes_delivered !== undefined) {
    update.notes_delivered = patch.notes_delivered;
  }
  if (patch.gameweek !== undefined) update.gameweek = patch.gameweek;
  if (patch.user_id !== undefined) update.user_id = patch.user_id;
  if (patch.lost_reason !== undefined) update.lost_reason = patch.lost_reason;

  if (patch.status && patch.status !== row.status) {
    update.status = patch.status;
    if (patch.status === "contacted" && !row.contacted_at) {
      update.contacted_at = now;
    }
    if (patch.status === "paid") {
      if (!row.paid_at) update.paid_at = now;
      if (
        patch.amount_collected_cny === undefined &&
        row.amount_collected_cny == null
      ) {
        update.amount_collected_cny = row.price_cny;
      }
      if (!row.contacted_at && !update.contacted_at) update.contacted_at = now;
    }
    if (patch.status === "fulfilled") {
      if (!row.fulfilled_at) update.fulfilled_at = now;
      if (!row.paid_at && !update.paid_at) update.paid_at = now;
      if (
        patch.amount_collected_cny === undefined &&
        row.amount_collected_cny == null &&
        update.amount_collected_cny === undefined
      ) {
        update.amount_collected_cny = row.price_cny;
      }
    }
    if (patch.status === "lost") {
      update.lost_at = now;
    }
  }

  const { data: updated, error } = await admin
    .from("pro_subscriptions")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const next = updated as ProSubscriptionRow;

  const shouldGrant =
    patch.grantPremium === true ||
    (patch.status === "fulfilled" &&
      next.sku === "founder_pack" &&
      Boolean(next.user_id));

  if (shouldGrant && next.user_id) {
    await grantInsightsPremium(next.user_id, {
      expiresAt: next.expires_at
        ? new Date(next.expires_at)
        : founderPackExpiresAt(),
    });
  }

  return { row: next, tableMissing: false };
}

export async function createManualProSubscription(input: {
  wechatId: string;
  email: string;
  sku: ProSubSku;
  priceCny?: number;
  status?: ProSubStatus;
  source?: ProSubSource;
  notes?: string;
  userId?: string | null;
  gameweek?: number | null;
}): Promise<{ row: ProSubscriptionRow; tableMissing: boolean }> {
  const admin = getServerSupabase();
  const sku = input.sku;
  const price = Math.round(input.priceCny ?? defaultPriceForSku(sku));
  const status = input.status ?? "lead";
  const now = new Date().toISOString();
  const insert: Record<string, unknown> = {
    wechat_id: input.wechatId.trim(),
    email: input.email.trim().toLowerCase(),
    user_id: input.userId ?? null,
    needs_signup: !input.userId,
    sku,
    price_cny: price,
    status,
    source: input.source ?? "manual",
    notes: input.notes ?? null,
    gameweek: input.gameweek ?? null,
    expires_at:
      sku === "founder_pack" ? founderPackExpiresAt().toISOString() : null,
  };
  if (status === "contacted") insert.contacted_at = now;
  if (status === "paid" || status === "fulfilled") {
    insert.paid_at = now;
    insert.amount_collected_cny = price;
    insert.contacted_at = now;
  }
  if (status === "fulfilled") insert.fulfilled_at = now;

  const { data, error } = await admin
    .from("pro_subscriptions")
    .insert(insert)
    .select("*")
    .single();

  if (error && isMissingTable(error)) {
    return { row: null as unknown as ProSubscriptionRow, tableMissing: true };
  }
  if (error) throw new Error(error.message);
  return { row: data as ProSubscriptionRow, tableMissing: false };
}
