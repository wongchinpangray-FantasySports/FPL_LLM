import { NextResponse } from "next/server";
import { listAdminAuthUsers } from "@/lib/auth/admin";
import { findAuthUserIdByEmail } from "@/lib/auth/confirm-user";
import { getAuthUser } from "@/lib/auth/session";
import {
  FOUNDER_SKUS,
  type FounderSkuId,
  founderPackClaimHref,
  founderPackIsPublic,
} from "@/lib/billing/founder-pack";
import { getUserInsightsPlan } from "@/lib/fpl/insights/access";
import { insertNotifications } from "@/lib/notifications/shared";
import { getServerSupabase } from "@/lib/supabase";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

export const dynamic = "force-dynamic";

function parseSku(raw: unknown): FounderSkuId | null {
  if (raw === "gw_note" || raw === "founder_pack") return raw;
  return null;
}

export async function POST(req: Request) {
  try {
    if (!founderPackIsPublic()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      wechatId?: string;
      sku?: string;
      email?: string;
    };
    const wechatId = String(body.wechatId ?? "").trim();
    const sku = parseSku(body.sku) ?? "founder_pack";
    if (wechatId.length < 2 || wechatId.length > 64) {
      return NextResponse.json(
        { error: "WeChat ID required (2–64 chars)" },
        { status: 400 },
      );
    }

    const user = await getAuthUser();
    const email =
      user?.email?.trim().toLowerCase() ||
      String(body.email ?? "")
        .trim()
        .toLowerCase();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    if (user) {
      const plan = await getUserInsightsPlan(user.id);
      if (plan === "premium" && sku === "founder_pack") {
        return NextResponse.json(
          { error: "Already Insights Pro", status: "already_premium" },
          { status: 409 },
        );
      }
    }

    const existingUserId = user?.id ?? (await findAuthUserIdByEmail(email));
    const needsSignup = !existingUserId;

    const admins = await listAdminAuthUsers();
    if (admins.length === 0) {
      return NextResponse.json(
        { error: "No admin inbox to notify" },
        { status: 503 },
      );
    }

    const skuMeta = FOUNDER_SKUS[sku];
    const href = existingUserId
      ? founderPackClaimHref(existingUserId)
      : `/admin?grantEmail=${encodeURIComponent(email)}`;
    const admin = getServerSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dedupeKey = `${wechatId}|${sku}|${email}`;
    const { data: existing } = await admin
      .from("user_notifications")
      .select("id,body")
      .eq("type", "founder_pack_claim")
      .gte("created_at", since)
      .limit(20);

    if (
      existing?.some((row) => String(row.body ?? "").includes(`wx:${wechatId}`))
    ) {
      return NextResponse.json({
        ok: true,
        status: "already_claimed",
        needsSignup,
      });
    }

    await insertNotifications(
      admin,
      admins.map((a) => ({
        user_id: a.id,
        type: "founder_pack_claim",
        title: `Lead · ${skuMeta.labelZh} ¥${skuMeta.priceCny}`,
        body: `Contact WeChat "${wechatId}" (wx:${wechatId}). Email ${email}${needsSignup ? " (not registered yet)" : ""}. SKU ${sku} ¥${skuMeta.priceCny}. Collect privately — no on-site QR. ${dedupeKey}`,
        href,
      })),
    );

    return NextResponse.json({ ok: true, status: "claimed", needsSignup });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Claim failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
