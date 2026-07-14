import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth/session";

export async function requireAuthForApi(): Promise<
  { user: User } | NextResponse
> {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}
