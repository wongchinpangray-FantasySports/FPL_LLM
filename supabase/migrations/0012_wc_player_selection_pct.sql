alter table public.wc_players
  add column if not exists selection_pct numeric(5, 2) default 0;
