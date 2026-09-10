import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { founderPackExpiresAt } from "@/lib/billing/founder-pack";
import {
  grantInsightsPremium,
  revokeInsightsPremium,
} from "@/lib/stripe/insights-billing";
import { getServerSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: { userId: string } };

type Body = {
  action?: "grant" | "revoke";
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdminUser();
    const userId = params.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    if (body.action !== "grant" && body.action !== "revoke") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }

    const admin = getServerSupabase();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!existing && body.action === "revoke") {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (body.action === "revoke") {
      await revokeInsightsPremium(userId);
      return NextResponse.json({
        ok: true,
        user_id: userId,
        insights_plan: "free",
        insights_plan_expires_at: null,
      });
    }

    const expiresAt = founderPackExpiresAt();
    await grantInsightsPremium(userId, { expiresAt });
    return NextResponse.json({
      ok: true,
      user_id: userId,
      insights_plan: "premium",
      insights_plan_expires_at: expiresAt.toISOString(),
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message =
      e instanceof Error ? e.message : "Failed to update Insights plan";
    return NextResponse.json({ error: message }, { status });
  }
}
