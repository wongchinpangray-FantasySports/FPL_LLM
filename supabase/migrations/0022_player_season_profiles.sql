-- Historical FPL: per-season player metadata + allow GW rows for retired players.

alter table public.player_gw_stats
  drop constraint if exists player_gw_stats_player_id_fkey;

create table if not exists public.player_season_profiles (
  player_id  integer not null,
  season     text not null,
  web_name   text not null default '',
  name       text not null default '',
  team       text not null default '',
  position   text not null default '',
  primary key (player_id, season)
);

create index if not exists player_season_profiles_season_idx
  on public.player_season_profiles (season);

create index if not exists player_season_profiles_season_pos_idx
  on public.player_season_profiles (season, position);

create or replace view public.fpl_seasons_list as
select distinct season from public.fixtures
union
select distinct season from public.player_gw_stats
union
select distinct season from public.player_season_profiles
order by season desc;
