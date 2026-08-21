import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  isFplEntryUniqueViolation,
  validateFplEntryExists,
} from "@/lib/auth/fpl-access";
import { toFplEntryPreview } from "@/lib/fpl/entry-preview";

export const dynamic = "force-dynamic";

type Params = { params: { userId: string } };

/** Admin: unlink FPL Entry ID from a user profile. */
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdminUser();
    const userId = params.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const admin = getServerSupabase();
    const now = new Date().toISOString();
    const { data, error } = await admin
      .from("profiles")
      .update({ fpl_entry_id: null, updated_at: now })
      .eq("id", userId)
      .select("id,fpl_entry_id")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user_id: data.id,
      fpl_entry_id: null,
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message =
      e instanceof Error ? e.message : "Failed to clear Entry ID";
    return NextResponse.json({ error: message }, { status });
  }
}

type SetBody = {
  fpl_entry_id?: number | null;
  /** If true, unlink the Entry ID from any other profile first. */
  force?: boolean;
};

/** Admin: set / replace a user's FPL Entry ID. */
export async function PATCH(req: Request, { params }: Params) {
  try {
    await requireAdminUser();
    const userId = params.userId?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const body = (await req.json()) as SetBody;
    const raw = body.fpl_entry_id;
    if (raw == null || !Number.isFinite(Number(raw)) || Number(raw) <= 0) {
      return NextResponse.json(
        { error: "Valid FPL Entry ID required" },
        { status: 400 },
      );
    }
    const entryId = Math.trunc(Number(raw));
    const force = Boolean(body.force);

    const entry = await validateFplEntryExists(entryId);
    const preview = toFplEntryPreview(entry);

    const admin = getServerSupabase();
    const now = new Date().toISOString();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("fpl_entry_id", entryId)
      .neq("id", userId)
      .maybeSingle();

    if (existing?.id) {
      if (!force) {
        return NextResponse.json(
          {
            error:
              "This Entry ID is already linked to another Faleague account. Use force to reassign.",
            conflict_user_id: existing.id,
            preview,
          },
          { status: 409 },
        );
      }
      const { error: clearErr } = await admin
        .from("profiles")
        .update({ fpl_entry_id: null, updated_at: now })
        .eq("id", existing.id);
      if (clearErr) throw new Error(clearErr.message);
    }

    const { data, error } = await admin
      .from("profiles")
      .update({ fpl_entry_id: entryId, updated_at: now })
      .eq("id", userId)
      .select("id,fpl_entry_id")
      .maybeSingle();

    if (error) {
      if (isFplEntryUniqueViolation(error.message)) {
        return NextResponse.json(
          {
            error:
              "This Entry ID is already linked to another Faleague account.",
            preview,
          },
          { status: 409 },
        );
      }
      throw new Error(error.message);
    }
    if (!data) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      user_id: data.id,
      fpl_entry_id: data.fpl_entry_id,
      preview,
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : /404|not found/i.test(e instanceof Error ? e.message : "")
          ? 404
          : 500;
    const message =
      e instanceof Error ? e.message : "Failed to set Entry ID";
    return NextResponse.json({ error: message }, { status });
  }
}
