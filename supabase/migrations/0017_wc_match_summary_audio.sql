-- Cached Gemini TTS audio (WAV base64) per locale for match summaries.

alter table public.wc_match_stats
  add column if not exists summary_audio_json jsonb;
