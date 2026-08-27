import { NextResponse } from "next/server";
import { getShareByCode } from "@/lib/share/store";
import { shareSiteOrigin } from "@/lib/share/card-copy";

export const dynamic = "force-dynamic";

/**
 * Share cards used to rasterize via `next/og` (resvg + yoga wasm). That pushed
 * the Cloudflare Worker over the free 3 MiB gzip limit. Serve the branded
 * static PNG instead; title/description still come from Open Graph meta tags.
 */
export async function GET(
  req: Request,
  { params }: { params: { code: string } },
) {
  const link = await getShareByCode(params.code).catch(() => null);
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }

  const candidates = [
    new URL("/commercial/end-card-zh-16x9.png", req.url).toString(),
    `${shareSiteOrigin()}/commercial/end-card-zh-16x9.png`,
  ];

  for (const url of candidates) {
    const img = await fetch(url).catch(() => null);
    if (!img?.ok) continue;
    return new NextResponse(img.body, {
      headers: {
        "Content-Type": img.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=600, s-maxage=3600",
      },
    });
  }

  return new NextResponse("OG image unavailable", { status: 503 });
}
