-- Stable favourite-club key across FPL season rollovers (bootstrap team ids shift).

alter table public.user_preferences
  add column if not exists fpl_team_short_name text;

comment on column public.user_preferences.fpl_team_short_name is
  'FPL short code (e.g. MCI) — source of truth; fpl_team_id is refreshed from teams table.';
