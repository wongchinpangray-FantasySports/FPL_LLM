import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { updateMiniLeagueInvite } from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdminUser();
    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    const body = (await req.json()) as {
      action?: "revoke" | "extend";
      extraEvents?: number;
    };
    if (body.action !== "revoke" && body.action !== "extend") {
      return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }
    const result =
      body.action === "revoke"
        ? await updateMiniLeagueInvite(id, { action: "revoke" })
        : await updateMiniLeagueInvite(id, {
            action: "extend",
            extraEvents: body.extraEvents,
          });
    if (!result.invite) {
      return NextResponse.json(
        { error: result.error ?? "not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ invite: result.invite });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update invite" },
      { status },
    );
  }
}
