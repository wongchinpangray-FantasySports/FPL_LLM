-- Link WC fantasy players to official FIFA fantasy element ids + enable full-pool sync.

alter table public.wc_players
  add column if not exists fifa_element_id integer;

alter table public.wc_players
  add column if not exists source text default 'seed';

create unique index if not exists wc_players_fifa_element_id_uidx
  on public.wc_players (fifa_element_id)
  where fifa_element_id is not null;

create index if not exists wc_players_source_idx on public.wc_players (source);
