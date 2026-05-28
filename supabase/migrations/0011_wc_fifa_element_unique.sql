-- PostgREST upsert needs a non-partial UNIQUE constraint on fifa_element_id.

drop index if exists public.wc_players_fifa_element_id_uidx;

alter table public.wc_players
  drop constraint if exists wc_players_fifa_element_id_key;

alter table public.wc_players
  add constraint wc_players_fifa_element_id_key unique (fifa_element_id);
