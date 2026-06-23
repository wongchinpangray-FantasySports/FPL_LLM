import { NextResponse } from "next/server";
import { wcTeamFlagIso } from "@/lib/wc/wc-team-flags";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.toUpperCase() ?? "";
  const w = Math.min(80, Math.max(20, Number(url.searchParams.get("w") ?? "40")));

  const iso = wcTeamFlagIso(code);
  if (!iso) {
    return new NextResponse("Unknown team code", { status: 404 });
  }

  try {
    const upstream = await fetch(`https://flagcdn.com/w${w}/${iso}.png`, {
      headers: {
        Accept: "image/png,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; Faleague/1.0; +https://fplllm.workers.dev)",
      },
      redirect: "follow",
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new NextResponse("Flag fetch failed", { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Flag fetch error", { status: 502 });
  }
}
