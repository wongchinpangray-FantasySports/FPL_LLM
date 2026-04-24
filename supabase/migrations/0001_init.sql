-- FPL LLM MVP - initial schema
-- Idempotent: safe to run multiple times.

------------------------------------------------------------
-- players_static
-- Extends the existing minimal table created by sync_fpl_players.py
-- (fpl_id, name, team, position, base_price) with richer stats.
------------------------------------------------------------
create table if not exists public.players_static (
  fpl_id           integer primary key,
  name             text        not null,
  team             text,
  position         text,
  base_price       numeric(4,1)
);

alter table public.players_static add column if not exists first_name            text;
alter table public.players_static add column if not exists second_name           text;
alter table public.players_static add column if not exists web_name              text;
alter table public.players_static add column if not exists team_id               integer;
alter table public.players_static add column if not exists status                text;
alter table public.players_static add column if not exists news                  text;
alter table public.players_static add column if not exists chance_of_playing     integer;
alter table public.players_static add column if not exists form                  numeric(5,2);
alter table public.players_static add column if not exists points_per_game       numeric(5,2);
alter table public.players_static add column if not exists total_points          integer;
alter table public.players_static add column if not exists minutes               integer;
alter table public.players_static add column if not exists goals_scored          integer;
alter table public.players_static add column if not exists assists               integer;
alter table public.players_static add column if not exists clean_sheets          integer;
alter table public.players_static add column if not exists bonus                 integer;
alter table public.players_static add column if not exists bps                   integer;
alter table public.players_static add column if not exists influence             numeric(6,2);
alter table public.players_static add column if not exists creativity            numeric(6,2);
alter table public.players_static add column if not exists threat                numeric(6,2);
alter table public.players_static add column if not exists ict_index             numeric(6,2);
alter table public.players_static add column if not exists expected_goals        numeric(6,2);
alter table public.players_static add column if not exists expected_assists      numeric(6,2);
alter table public.players_static add column if not exists expected_goal_involve numeric(6,2);
alter table public.players_static add column if not exists selected_by_percent   numeric(5,2);
alter table public.players_static add column if not exists transfers_in_event    integer;
alter table public.players_static add column if not exists transfers_out_event   integer;
alter table public.players_static add column if not exists photo                 text;
alter table public.players_static add column if not exists updated_at            timestamptz default now();

create index if not exists players_static_team_idx     on public.players_static (team);
create index if not exists players_static_position_idx on public.players_static (position);
create index if not exists players_static_name_idx     on public.players_static using gin (to_tsvector('simple', coalesce(web_name,'') || ' ' || name));

------------------------------------------------------------
-- teams
------------------------------------------------------------
create table if not exists public.teams (
  id              integer primary key,
  name            text not null,
  short_name      text not null,
  code            integer,
  strength        integer,
  strength_home   integer,
  strength_away   integer,
  strength_overall_home integer,
  strength_overall_away integer,
  strength_attack_home  integer,
  strength_attack_away  integer,
  strength_defence_home integer,
  strength_defence_away integer,
  updated_at      timestamptz default now()
);

------------------------------------------------------------
-- gameweeks
------------------------------------------------------------
create table if not exists public.gameweeks (
  id            integer primary key,
  name          text,
  deadline_time timestamptz,
  is_current    boolean default false,
  is_next       boolean default false,
  is_previous   boolean default false,
  finished      boolean default false,
  data_checked  boolean default false,
  updated_at    timestamptz default now()
);

------------------------------------------------------------
-- fixtures
------------------------------------------------------------
create table if not exists public.fixtures (
  id               integer primary key,
  gw               integer references public.gameweeks (id),
  kickoff_time     timestamptz,
  home_team_id     integer references public.teams (id),
  away_team_id     integer references public.teams (id),
  home_team_score  integer,
  away_team_score  integer,
  home_fdr         integer,
  away_fdr         integer,
  finished         boolean default false,
  finished_provisional boolean default false,
  started          boolean default false,
  minutes          integer default 0,
  updated_at       timestamptz default now()
);

create index if not exists fixtures_gw_idx        on public.fixtures (gw);
create index if not exists fixtures_home_team_idx on public.fixtures (home_team_id);
create index if not exists fixtures_away_team_idx on public.fixtures (away_team_id);

------------------------------------------------------------
-- player_gw_stats - per-player per-gameweek from /event/{gw}/live
-- and /element-summary/{id}/ history
------------------------------------------------------------
create table if not exists public.player_gw_stats (
  player_id        integer not null references public.players_static (fpl_id) on delete cascade,
  gw               integer not null,
  fixture_id       integer,
  opponent_team_id integer,
  was_home         boolean,
  minutes          integer,
  goals_scored     integer,
  assists          integer,
  clean_sheets     integer,
  goals_conceded   integer,
  own_goals        integer,
  penalties_saved  integer,
  penalties_missed integer,
  yellow_cards     integer,
  red_cards        integer,
  saves            integer,
  bonus            integer,
  bps              integer,
  influence        numeric(6,2),
  creativity       numeric(6,2),
  threat           numeric(6,2),
  ict_index        numeric(6,2),
  expected_goals   numeric(6,2),
  expected_assists numeric(6,2),
  expected_goal_involve numeric(6,2),
  expected_goals_conceded numeric(6,2),
  value            numeric(4,1),
  selected         integer,
  transfers_in     integer,
  transfers_out    integer,
  total_points     integer,
  updated_at       timestamptz default now(),
  primary key (player_id, gw)
);

create index if not exists player_gw_stats_gw_idx on public.player_gw_stats (gw);

------------------------------------------------------------
-- understat_xg - scraped from understat.com
-- Joined to players_static by fuzzy (name, team).
------------------------------------------------------------
create table if not exists public.understat_xg (
  id            bigserial primary key,
  understat_id  text,
  player_name   text not null,
  team          text,
  season        text not null,
  gw            integer,
  match_date    date,
  minutes       integer,
  goals         integer,
  assists       integer,
  shots         integer,
  key_passes    integer,
  xg            numeric(6,3),
  xa            numeric(6,3),
  npg           integer,
  npxg          numeric(6,3),
  matched_fpl_id integer references public.players_static (fpl_id),
  updated_at    timestamptz default now(),
  unique (understat_id, season, match_date)
);

create index if not exists understat_xg_name_idx    on public.understat_xg (lower(player_name));
create index if not exists understat_xg_matched_idx on public.understat_xg (matched_fpl_id);

------------------------------------------------------------
-- user_teams - cached FPL entry picks for the chat assistant
------------------------------------------------------------
create table if not exists public.user_teams (
  entry_id     integer primary key,
  entry_name   text,
  player_name  text,
  summary_overall_points integer,
  summary_overall_rank   integer,
  current_gw   integer,
  bank         numeric(5,1),
  team_value   numeric(5,1),
  free_transfers integer,
  chips_used   jsonb,
  picks        jsonb,
  raw          jsonb,
  fetched_at   timestamptz default now()
);

create index if not exists user_teams_fetched_at_idx on public.user_teams (fetched_at);
