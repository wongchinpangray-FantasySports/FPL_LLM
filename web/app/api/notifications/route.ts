import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supa = createSupabaseServerClient();
    const { data: authData, error: authError } = await supa.auth.getUser();
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "30")));

    const [{ data: items, error: listErr }, { count: unread }] = await Promise.all([
      supa
        .from("user_notifications")
        .select("id,type,title,body,href,read_at,created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      supa
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
    ]);

    if (listErr) throw new Error(listErr.message);

    return NextResponse.json({
      items: items ?? [],
      unread_count: unread ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
