-- Scope fixtures + player_gw_stats by FPL "season start year" (e.g. 2025 for 2025/26).
-- Prevents mixing last season's GW rows with the current campaign.

------------------------------------------------------------
-- fpl_meta: canonical current season for the web app + sync jobs
------------------------------------------------------------
create table if not exists public.fpl_meta (
  key          text primary key,
  value        text not null,
  updated_at   timestamptz default now()
);

insert into public.fpl_meta (key, value)
values ('current_season', '2024')
on conflict (key) do nothing;

------------------------------------------------------------
-- fixtures: season column (FPL fixture ids are unique; gw repeats each year)
------------------------------------------------------------
alter table public.fixtures
  add column if not exists season text;

update public.fixtures set season = '2024' where season is null;

alter table public.fixtures
  alter column season set not null;

create index if not exists fixtures_season_gw_idx
  on public.fixtures (season, gw);

------------------------------------------------------------
-- player_gw_stats: composite PK (player_id, gw, season)
------------------------------------------------------------
alter table public.player_gw_stats
  add column if not exists season text;

update public.player_gw_stats set season = '2024' where season is null;

alter table public.player_gw_stats
  alter column season set not null;

alter table public.player_gw_stats
  drop constraint if exists player_gw_stats_pkey;

alter table public.player_gw_stats
  add primary key (player_id, gw, season);

create index if not exists player_gw_stats_season_gw_idx
  on public.player_gw_stats (season, gw);
