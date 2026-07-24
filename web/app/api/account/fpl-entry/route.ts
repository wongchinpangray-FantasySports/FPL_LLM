import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";
import {
  isFplEntryUniqueViolation,
  validateFplEntryExists,
} from "@/lib/auth/fpl-access";

export const dynamic = "force-dynamic";

type Body = { fpl_entry_id?: number | null };

export async function PATCH(req: Request) {
  try {
    if (!getSupabaseAuthEnv()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    const raw = body.fpl_entry_id;
    if (raw == null || !Number.isFinite(raw) || raw <= 0) {
      return NextResponse.json(
        { error: "Valid FPL Entry ID required" },
        { status: 400 },
      );
    }

    const entryId = Math.trunc(Number(raw));
    await validateFplEntryExists(entryId);

    const userId = authData.user.id;
    const admin = getServerSupabase();
    const now = new Date().toISOString();

    const { error } = await admin
      .from("profiles")
      .update({ fpl_entry_id: entryId, updated_at: now })
      .eq("id", userId);

    if (error) {
      if (isFplEntryUniqueViolation(error.message)) {
        return NextResponse.json(
          {
            error:
              "This Entry ID is already linked to another Faleague account.",
          },
          { status: 409 },
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, fpl_entry_id: entryId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update Entry ID";
    const status = /FPL .*403/.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
