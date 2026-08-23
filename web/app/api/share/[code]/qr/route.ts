import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getShareByCode } from "@/lib/share/store";
import { sharePublicOrigin } from "@/lib/share/origin";
import { sharePagePath } from "@/lib/share/card-copy";

export const dynamic = "force-dynamic";

/** SVG QR via `qrcode` (Google Chart is blocked in CN). */
export async function GET(
  req: Request,
  { params }: { params: { code: string } },
) {
  const link = await getShareByCode(params.code);
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = `${sharePublicOrigin(req)}${sharePagePath(link.code)}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    width: 240,
    color: { dark: "#0b1f17", light: "#ffffff" },
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
