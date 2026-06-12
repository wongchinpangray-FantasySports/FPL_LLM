-- Structured match events (goals with assists, cards) for match centre UI.

alter table public.wc_match_stats
  add column if not exists home_goals jsonb,
  add column if not exists away_goals jsonb,
  add column if not exists home_cards jsonb,
  add column if not exists away_cards jsonb;
