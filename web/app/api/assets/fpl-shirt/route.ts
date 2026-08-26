import { NextResponse } from "next/server";

/** Same-origin proxy for FPL kit images so canvas export is not CORS-blocked. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = Number(url.searchParams.get("code"));
  const gk = url.searchParams.get("gk") === "1";

  if (!Number.isInteger(code) || code < 0 || code > 99) {
    return new NextResponse("Invalid shirt code", { status: 400 });
  }

  const file = `shirt_${code}${gk ? "_1" : ""}-66.webp`;
  const upstreamUrl = `https://fantasy.premierleague.com/dist/img/shirts/standard/${file}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "image/webp,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Referer: "https://fantasy.premierleague.com/",
      },
      redirect: "follow",
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new NextResponse("Shirt fetch failed", { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/webp";
    if (!contentType.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 415 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Shirt fetch error", { status: 502 });
  }
}
