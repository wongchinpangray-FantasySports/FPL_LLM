import { NextResponse } from "next/server";
import { loadKnockoutBracket } from "@/lib/wc/load-knockout-bracket";
import { readLocaleFromRequest } from "@/lib/wc/localize-players";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const locale = readLocaleFromRequest(req);
    const bracket = await loadKnockoutBracket(locale);

    return NextResponse.json(
      {
        bracket,
        disclaimer:
          "Knockout path from FIFA fantasy schedule; later rounds fill as results land.",
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load bracket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
