import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  PRO_SUB_SKUS,
  PRO_SUB_SOURCES,
  PRO_SUB_STATUSES,
  createManualProSubscription,
  listProSubscriptions,
  type ProSubSku,
  type ProSubSource,
  type ProSubStatus,
} from "@/lib/billing/pro-subscriptions";
import { getProSampleFunnel } from "@/lib/billing/pro-sample-funnel";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const { rows, progress, tableMissing } = await listProSubscriptions();
    const sampleFunnel = await getProSampleFunnel({
      leads: progress.total,
      payers: progress.payers,
    });
    return NextResponse.json({ rows, progress, tableMissing, sampleFunnel });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load subscriptions" },
      { status },
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireAdminUser();
    const body = (await req.json().catch(() => ({}))) as {
      wechatId?: string;
      email?: string;
      sku?: string;
      priceCny?: number;
      status?: string;
      source?: string;
      notes?: string;
      userId?: string;
      gameweek?: number;
    };

    const wechatId = String(body.wechatId ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (wechatId.length < 2 || !email.includes("@")) {
      return NextResponse.json(
        { error: "wechatId and email required" },
        { status: 400 },
      );
    }

    const sku = (PRO_SUB_SKUS as readonly string[]).includes(body.sku ?? "")
      ? (body.sku as ProSubSku)
      : "founder_pack";
    const status = (PRO_SUB_STATUSES as readonly string[]).includes(
      body.status ?? "",
    )
      ? (body.status as ProSubStatus)
      : "lead";
    const source = (PRO_SUB_SOURCES as readonly string[]).includes(
      body.source ?? "",
    )
      ? (body.source as ProSubSource)
      : "manual";

    const { row, tableMissing } = await createManualProSubscription({
      wechatId,
      email,
      sku,
      priceCny:
        typeof body.priceCny === "number" && body.priceCny >= 0
          ? body.priceCny
          : undefined,
      status,
      source,
      notes: body.notes,
      userId: body.userId?.trim() || null,
      gameweek:
        typeof body.gameweek === "number" ? body.gameweek : undefined,
    });

    if (tableMissing) {
      return NextResponse.json(
        {
          error:
            "Run supabase/migrations/0038_pro_subscriptions.sql in the Supabase SQL editor first.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, row });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create" },
      { status },
    );
  }
}
