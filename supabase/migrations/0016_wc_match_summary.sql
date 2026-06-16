-- AI-generated match summaries (text), cached per locale in JSON.

alter table public.wc_match_stats
  add column if not exists summary_json jsonb,
  add column if not exists summary_fingerprint text;
