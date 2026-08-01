import { NextResponse } from "next/server";
import {
  loadHistoricalMeta,
  parseHistoricalQueryParams,
  queryHistoricalStats,
} from "@/lib/fpl/historical-data";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get("meta") === "1") {
    try {
      const meta = await loadHistoricalMeta();
      return NextResponse.json(meta);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load meta";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    const params = parseHistoricalQueryParams(searchParams);
    const result = await queryHistoricalStats(params);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
