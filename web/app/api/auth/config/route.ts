import { NextResponse } from "next/server";
import { getSupabaseAuthEnv } from "@/lib/supabase/auth-config";

export const dynamic = "force-dynamic";

/** Public Supabase auth config for the browser (anon key is safe to expose). */
export async function GET() {
  const env = getSupabaseAuthEnv();
  if (!env) {
    return NextResponse.json(
      { error: "Auth not configured on server" },
      { status: 503 },
    );
  }
  return NextResponse.json({ url: env.url, anonKey: env.key });
}
