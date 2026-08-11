import { NextResponse } from "next/server";
import { buildMiniTemplates } from "@/lib/mini/templates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const templates = await buildMiniTemplates();
    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        titleKey: t.titleKey,
        bodyKey: t.bodyKey,
        pick_ids: t.pick_ids,
        captain_fpl_id: t.captain_fpl_id,
        vice_fpl_id: t.vice_fpl_id,
        players: t.players.map((p) => ({
          fpl_id: p.fpl_id,
          web_name: p.web_name,
          team: p.team,
          team_id: p.team_id,
          position: p.position,
          base_price: p.base_price,
          form: p.form,
          selected_by_percent: p.selected_by_percent,
          total_points: p.total_points,
        })),
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build templates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
