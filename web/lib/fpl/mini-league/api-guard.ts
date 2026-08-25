import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { resolveMiniLeagueAccess } from "@/lib/fpl/mini-league/beta";

export function allowLocalMiniLeaguePreview(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_LOCAL_DASHBOARD_PREVIEW === "1"
  );
}

export async function miniLeagueApiGate(
  user: User | null,
): Promise<NextResponse | null> {
  if (allowLocalMiniLeaguePreview()) return null;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await resolveMiniLeagueAccess({
    id: user.id,
    email: user.email ?? null,
  });
  if (access.allowed) return null;
  const error =
    access.reason === "expired"
      ? "beta_expired"
      : access.reason === "premium_required"
        ? "premium_required"
        : access.reason === "unauthenticated"
          ? "Unauthorized"
          : "beta_required";
  const status = error === "premium_required" ? 402 : error === "Unauthorized" ? 401 : 403;
  return NextResponse.json({ error }, { status });
}
