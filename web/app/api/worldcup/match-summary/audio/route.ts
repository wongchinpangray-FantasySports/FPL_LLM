import { NextResponse } from "next/server";
import { buildWcMatchSchedule } from "@/lib/wc/fifa-rounds";
import {
  canSummarizeMatch,
  getOrCreateMatchSummary,
} from "@/lib/wc/match-summary";
import { getOrCreateMatchSummaryAudio } from "@/lib/wc/match-summary-tts";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const matchId = Number(url.searchParams.get("matchId") ?? "0");
    const locale = url.searchParams.get("locale") ?? "en";

    if (!Number.isFinite(matchId) || matchId <= 0) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    const { matches } = await buildWcMatchSchedule();
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!canSummarizeMatch(match)) {
      return NextResponse.json(
        { error: "Audio available after full time" },
        { status: 400 },
      );
    }

    const summaryResult = await getOrCreateMatchSummary(match, locale);
    const audio = await getOrCreateMatchSummaryAudio(
      match,
      summaryResult,
      locale,
    );

    if (!audio) {
      return NextResponse.json(
        { error: "TTS unavailable", fallback: "browser" },
        { status: 503 },
      );
    }

    return new NextResponse(Buffer.from(audio.wav), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=86400",
        "X-Audio-Source": audio.source,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to generate match audio";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
