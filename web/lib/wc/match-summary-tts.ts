import { getServerSupabase } from "@/lib/supabase";
import { getGenAI } from "@/lib/llm";
import type { MatchSummaryResult } from "@/lib/wc/match-summary";
import type { WcMatchRow } from "@/lib/wc/fifa-rounds";

const TTS_MODELS = [
  process.env.GEMINI_TTS_MODEL?.trim(),
  "gemini-2.5-flash-preview-tts",
  "gemini-2.5-pro-preview-tts",
  "gemini-3.1-flash-tts-preview",
].filter(Boolean) as string[];

function normalizeLocale(locale: string): "en" | "zh" {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function ttsVoice(locale: "en" | "zh"): string {
  if (locale === "zh") return process.env.GEMINI_TTS_VOICE_ZH?.trim() || "Iapetus";
  return process.env.GEMINI_TTS_VOICE_EN?.trim() || "Algieba";
}

function ttsPrompt(summary: string, locale: "en" | "zh"): string {
  if (locale === "zh") {
    return (
      "请用专业、沉稳的中文足球评论员口吻，完整朗读以下世界杯比赛战报。" +
      "全文使用普通话，语速适中，像在电台赛后总结。" +
      "不要添加原文没有的内容，不要改用英文：" +
      "\n\n" +
      summary
    );
  }
  return (
    "Read the following World Cup match summary aloud in the calm, confident tone " +
    "of a professional football commentator on a post-match radio recap. " +
    "Keep a natural pace. Do not add facts that are not in the text:\n\n" +
    summary
  );
}

function writeWavHeader(
  view: DataView,
  pcmByteLength: number,
  sampleRate: number,
): void {
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcmByteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, pcmByteLength, true);
}

export function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  writeWavHeader(new DataView(header), pcm.length, sampleRate);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

function decodeBase64(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, "base64"));
}

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function generateGeminiTtsWav(
  summary: string,
  locale: "en" | "zh",
): Promise<Uint8Array | null> {
  const ai = await getGenAI();
  const prompt = ttsPrompt(summary, locale);
  const voiceName = ttsVoice(locale);

  for (const model of TTS_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const inline = response.candidates?.[0]?.content?.parts?.find(
        (p) => "inlineData" in p && p.inlineData?.data,
      );
      const raw = inline && "inlineData" in inline ? inline.inlineData : null;
      if (!raw?.data) continue;

      const mime = raw.mimeType ?? "";
      const bytes = decodeBase64(raw.data);
      if (mime.includes("wav")) return bytes;
      return pcmToWav(bytes, mime.includes("rate=16000") ? 16000 : 24000);
    } catch {
      continue;
    }
  }
  return null;
}

async function loadCachedAudio(
  matchId: number,
  locale: "en" | "zh",
  fingerprint: string,
): Promise<Uint8Array | null> {
  try {
    const supa = getServerSupabase();
    const { data } = await supa
      .from("wc_match_stats")
      .select("summary_audio_json, summary_fingerprint")
      .eq("fifa_tournament_id", matchId)
      .maybeSingle();
    if (!data || data.summary_fingerprint !== fingerprint) return null;
    const json = data.summary_audio_json as Record<string, string> | null;
    const b64 = json?.[locale];
    if (!b64) return null;
    return decodeBase64(b64);
  } catch {
    return null;
  }
}

async function saveCachedAudio(
  match: WcMatchRow,
  locale: "en" | "zh",
  wav: Uint8Array,
  fingerprint: string,
): Promise<void> {
  try {
    const supa = getServerSupabase();
    const { data: existing } = await supa
      .from("wc_match_stats")
      .select("summary_audio_json")
      .eq("fifa_tournament_id", match.id)
      .maybeSingle();

    const prev =
      (existing?.summary_audio_json as Record<string, string> | null) ?? {};
    const summary_audio_json = {
      ...prev,
      [locale]: encodeBase64(wav),
    };

    const { error } = await supa
      .from("wc_match_stats")
      .update({
        summary_audio_json,
        summary_fingerprint: fingerprint,
        updated_at: new Date().toISOString(),
      })
      .eq("fifa_tournament_id", match.id);

    if (error) {
      await supa.from("wc_match_stats").upsert(
        {
          fifa_tournament_id: match.id,
          round_id: match.round_id,
          kickoff: match.kickoff,
          venue: match.venue,
          venue_city: match.venue_city,
          status: match.status,
          period: match.period,
          minutes: match.minutes,
          extra_minutes: match.extra_minutes,
          home_code: match.home_code,
          away_code: match.away_code,
          home_name: match.home_name,
          away_name: match.away_name,
          home_score: match.home_score,
          away_score: match.away_score,
          home_scorers: match.home_scorers,
          away_scorers: match.away_scorers,
          summary_audio_json,
          summary_fingerprint: fingerprint,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "fifa_tournament_id" },
      );
    }
  } catch {
    /* optional cache */
  }
}

export type MatchSummaryAudioResult = {
  wav: Uint8Array;
  source: "cache" | "gemini";
};

export async function getOrCreateMatchSummaryAudio(
  match: WcMatchRow,
  summaryResult: MatchSummaryResult,
  localeInput: string,
): Promise<MatchSummaryAudioResult | null> {
  const locale = normalizeLocale(localeInput);
  const fingerprint = summaryResult.fingerprint;

  const cached = await loadCachedAudio(match.id, locale, fingerprint);
  if (cached) return { wav: cached, source: "cache" };

  const wav = await generateGeminiTtsWav(summaryResult.summary, locale);
  if (!wav) return null;

  await saveCachedAudio(match, locale, wav, fingerprint);
  return { wav, source: "gemini" };
}
