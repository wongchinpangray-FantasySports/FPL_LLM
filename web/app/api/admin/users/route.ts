import { NextResponse } from "next/server";
import { fetchAdminUsers } from "@/lib/admin/users";
import { requireAdminUser } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const users = await fetchAdminUsers();
    return NextResponse.json({
      users,
      total: users.length,
      onboarded: users.filter((u) => u.onboarding.completed_at).length,
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    const message = e instanceof Error ? e.message : "Failed to load users";
    return NextResponse.json({ error: message }, { status });
  }
}
