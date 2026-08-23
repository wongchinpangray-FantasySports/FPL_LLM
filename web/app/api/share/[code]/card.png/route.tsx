import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { getShareByCode } from "@/lib/share/store";
import { loadSharePreview } from "@/lib/share/preview";
import { shareKindEyebrow, shareSiteOrigin } from "@/lib/share/card-copy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

function hasCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

function latinOr(text: string, fallback: string): string {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  return hasCjk(trimmed) ? fallback : trimmed;
}

async function loadFontFromUrl(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

async function loadCjkFont(text: string): Promise<ArrayBuffer | null> {
  const glyphs = [...new Set(text)].join("").slice(0, 120);
  if (!glyphs) return null;
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&display=swap&text=${encodeURIComponent(glyphs)}`;
  try {
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(2500),
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+)\)/);
    const fontUrl = match?.[1]?.replace(/['"]/g, "");
    if (!fontUrl) return null;
    return await loadFontFromUrl(fontUrl);
  } catch {
    return null;
  }
}

async function loadLatinFont(): Promise<ArrayBuffer | null> {
  return loadFontFromUrl(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-700-normal.ttf",
  );
}

async function fallbackPng(): Promise<NextResponse> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(
      join(process.cwd(), "public/commercial/end-card-zh-16x9.png"),
    );
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600",
      },
    });
  } catch {
    const fallback = `${shareSiteOrigin()}/commercial/end-card-zh-16x9.png`;
    const img = await fetch(fallback).catch(() => null);
    if (img?.ok) {
      return new NextResponse(img.body, {
        headers: {
          "Content-Type": img.headers.get("content-type") ?? "image/png",
          "Cache-Control": "public, max-age=600",
        },
      });
    }
    return new NextResponse("OG image unavailable", { status: 503 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
) {
  const link = await getShareByCode(params.code).catch(() => null);
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }

  const preview = await loadSharePreview({
    kind: link.kind,
    target_path: link.target_path,
    title: link.title,
    ref_id: link.ref_id,
  }).catch(() => ({
    kind: link.kind,
    title: link.title || "FALEAGUE",
    subtitle: null,
    href: link.target_path,
    items: [],
  }));

  const glyphSource = [
    preview.title,
    preview.subtitle ?? "",
    ...preview.items.flatMap((item) => [item.label, item.value]),
  ].join("");
  const cjkFont = await loadCjkFont(glyphSource);
  const latinFont = cjkFont ? null : await loadLatinFont();
  const canCjk = Boolean(cjkFont);
  if (!cjkFont && !latinFont) {
    return fallbackPng();
  }

  const fontName = canCjk ? "Noto Sans SC" : "Inter";

  const headline = canCjk
    ? preview.title || shareKindEyebrow(preview.kind)
    : latinOr(preview.title, shareKindEyebrow(preview.kind));
  const kicker = shareKindEyebrow(preview.kind);
  const subtitle = canCjk
    ? preview.subtitle ?? ""
    : latinOr(preview.subtitle ?? "", "");
  const rows = preview.items.slice(0, 5).map((item) => {
    if (preview.kind === "scout_article") {
      const excerpt = item.value.slice(0, 64);
      return {
        left: canCjk ? excerpt : latinOr(excerpt, "Scout article"),
        right: "",
      };
    }
    return {
      left: canCjk ? item.label : latinOr(item.label, item.hint ?? "Pick"),
      right: canCjk ? item.value : latinOr(item.value, ""),
    };
  });

  try {
    const png = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#07060c",
            color: "#f4f1fb",
            padding: "56px 64px",
            fontFamily: fontName,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", fontSize: 28, letterSpacing: 4 }}>
              <span style={{ color: "#f4f1fb", fontWeight: 700 }}>FALEA</span>
              <span style={{ color: "#00ff87", fontWeight: 700 }}>GUE</span>
            </div>
            <div
              style={{
                display: "flex",
                color: "#00ff87",
                fontSize: 22,
                letterSpacing: 3,
                fontWeight: 600,
              }}
            >
              {kicker}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: headline.length > 22 ? 44 : 56,
              fontWeight: 700,
              lineHeight: 1.15,
            }}
          >
            {headline}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 26,
                color: "#b7b3c5",
              }}
            >
              {subtitle}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              gap: 12,
              flex: 1,
            }}
          >
            {rows.map((row) => (
              <div
                key={`${row.left}-${row.right}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 30,
                }}
              >
                <span style={{ color: "#f4f1fb" }}>{row.left}</span>
                {row.right ? (
                  <span style={{ color: "#00ff87", fontWeight: 700 }}>
                    {row.right}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              color: "#8c879a",
              fontSize: 22,
              letterSpacing: 1,
            }}
          >
            faleague-ai.com
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: [
          {
            name: fontName,
            data: (cjkFont ?? latinFont) as ArrayBuffer,
            weight: 700,
            style: "normal",
          },
        ],
      },
    );
    const bytes = await png.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=600, s-maxage=3600",
      },
    });
  } catch {
    return fallbackPng();
  }
}
