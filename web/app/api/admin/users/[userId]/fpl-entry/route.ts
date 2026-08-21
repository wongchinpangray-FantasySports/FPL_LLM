import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { requireAdminUser } from "@/lib/auth/admin";

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
