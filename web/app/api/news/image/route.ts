import { NextResponse } from "next/server";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
]);

function isAllowedImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (BLOCKED_HOSTS.has(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !isAllowedImageUrl(url)) {
    return new NextResponse("Invalid image URL", { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FaleagueBot/1.0; +https://fplllm.pages.dev)",
        Accept: "image/*,*/*;q=0.8",
      },
      redirect: "follow",
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new NextResponse("Image fetch failed", { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
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
    return new NextResponse("Image fetch error", { status: 502 });
  }
}
