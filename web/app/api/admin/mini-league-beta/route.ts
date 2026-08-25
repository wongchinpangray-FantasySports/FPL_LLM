import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  MINI_LEAGUE_BETA_DURATION_EVENTS,
  MINI_LEAGUE_BETA_RECOMMENDED_TESTERS,
  MINI_LEAGUE_BETA_TESTER_MAX,
  MINI_LEAGUE_BETA_TESTER_MIN,
  createMiniLeagueInvites,
  listMiniLeagueInvites,
  parseInviteEmails,
} from "@/lib/fpl/mini-league/beta";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminUser();
    const { invites, tableMissing, currentGw } = await listMiniLeagueInvites();
    const active = invites.filter((i) => i.effectiveStatus === "active").length;
    const pending = invites.filter((i) => i.effectiveStatus === "pending").length;
    return NextResponse.json({
      invites,
      tableMissing,
      currentGw,
      counts: {
        total: invites.length,
        active,
        pending,
        recommended: MINI_LEAGUE_BETA_RECOMMENDED_TESTERS,
        min: MINI_LEAGUE_BETA_TESTER_MIN,
        max: MINI_LEAGUE_BETA_TESTER_MAX,
      },
      defaultDuration: MINI_LEAGUE_BETA_DURATION_EVENTS,
    });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load invites" },
      { status },
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdminUser();
    const body = (await req.json()) as {
      emails?: string;
      extraLinks?: number;
      durationEvents?: number;
      startMode?: "on_claim" | "now";
      notes?: string;
    };
    const emails = parseInviteEmails(body.emails ?? "");
    const result = await createMiniLeagueInvites({
      emails,
      extraLinks: body.extraLinks,
      durationEvents: body.durationEvents,
      startMode: body.startMode === "now" ? "now" : "on_claim",
      notes: body.notes,
      invitedBy: admin.id,
    });
    if (result.error === "empty") {
      return NextResponse.json(
        { error: "Add at least one email or extra invite link." },
        { status: 400 },
      );
    }
    if (result.tableMissing || result.error === "missing_table") {
      return NextResponse.json(
        {
          error:
            "Run supabase/migrations/0036_mini_league_beta.sql in the Supabase SQL editor first.",
        },
        { status: 503 },
      );
    }
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ invites: result.invites });
  } catch (e) {
    const status =
      e instanceof Error && "status" in e && typeof e.status === "number"
        ? e.status
        : 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create invites" },
      { status },
    );
  }
}
