alter table public.wc_players
  add column if not exists season_club text,
  add column if not exists season_league text,
  add column if not exists club_source text;

create index if not exists wc_players_season_club_null_idx
  on public.wc_players (id)
  where season_club is null;
