import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  PRO_SUB_STATUSES,
  updateProSubscription,
  type ProSubStatus,
} from "@/lib/billing/pro-subscriptions";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdminUser();
    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      notes?: string | null;
      amount_collected_cny?: number | null;
      notes_delivered?: number;
      gameweek?: number | null;
      user_id?: string | null;
      lost_reason?: string | null;
      grantPremium?: boolean;
    };

    const patch: Parameters<typeof updateProSubscription>[1] = {};
    if (
      body.status &&
      (PRO_SUB_STATUSES as readonly string[]).includes(body.status)
    ) {
      patch.status = body.status as ProSubStatus;
    }
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.amount_collected_cny !== undefined) {
      patch.amount_collected_cny = body.amount_collected_cny;
    }
    if (typeof body.notes_delivered === "number") {
      patch.notes_delivered = body.notes_delivered;
    }
    if (body.gameweek !== undefined) patch.gameweek = body.gameweek;
    if (body.user_id !== undefined) patch.user_id = body.user_id;
    if (body.lost_reason !== undefined) patch.lost_reason = body.lost_reason;
    if (body.grantPremium === true) patch.grantPremium = true;

    const { row, tableMissing } = await updateProSubscription(id, patch);
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
      { error: e instanceof Error ? e.message : "Failed to update" },
      { status },
    );
  }
}
