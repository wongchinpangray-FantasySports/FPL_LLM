-- Long-form AI match articles (headline + body), cached per locale.

alter table public.wc_match_stats
  add column if not exists article_json jsonb,
  add column if not exists article_fingerprint text;
