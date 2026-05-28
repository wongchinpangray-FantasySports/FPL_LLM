-- =============================================================================
-- FPL_LLM: fresh Supabase database (run once in SQL Editor)
-- Concatenates 0001_init through 0006_fpl_seasons_list_view in order.
-- Safe on empty DB. If tables already exist, prefer running 0001-0006 individually.
-- =============================================================================


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0001_init.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0002_setpieces.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Adds set-piece / penalty order fields from FPL bootstrap-static.
-- Low values (1) = primary taker. NULL = no known duty.
alter table public.players_static add column if not exists penalties_order                   integer;
alter table public.players_static add column if not exists direct_freekicks_order            integer;
alter table public.players_static add column if not exists corners_and_indirect_freekicks_order integer;
alter table public.players_static add column if not exists penalties_text                    text;
alter table public.players_static add column if not exists direct_freekicks_text             text;
alter table public.players_static add column if not exists corners_and_indirect_freekicks_text text;

create index if not exists players_static_pens_idx
  on public.players_static (penalties_order)
  where penalties_order is not null;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0003_defensive_stats.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- 2025/26 FPL defensive stats + defensive-contribution scoring.
-- Season-level columns on players_static ------------------------------------
alter table public.players_static add column if not exists goals_conceded                 integer;
alter table public.players_static add column if not exists expected_goals_conceded        numeric(7,3);
alter table public.players_static add column if not exists saves                          integer;
alter table public.players_static add column if not exists clearances_blocks_interceptions integer;
alter table public.players_static add column if not exists recoveries                     integer;
alter table public.players_static add column if not exists tackles                        integer;
alter table public.players_static add column if not exists defensive_contribution         integer;
alter table public.players_static add column if not exists defensive_contribution_per_90  numeric(7,3);
alter table public.players_static add column if not exists goals_conceded_per_90          numeric(7,3);
alter table public.players_static add column if not exists expected_goals_conceded_per_90 numeric(7,3);
alter table public.players_static add column if not exists saves_per_90                   numeric(7,3);
alter table public.players_static add column if not exists starts                         integer;
alter table public.players_static add column if not exists starts_per_90                  numeric(7,3);

-- Per-GW additions ---------------------------------------------------------
alter table public.player_gw_stats add column if not exists clearances_blocks_interceptions integer;
alter table public.player_gw_stats add column if not exists recoveries                      integer;
alter table public.player_gw_stats add column if not exists tackles                         integer;
alter table public.player_gw_stats add column if not exists defensive_contribution          integer;
alter table public.player_gw_stats add column if not exists starts                          integer;

create index if not exists player_gw_stats_dc_idx
  on public.player_gw_stats (defensive_contribution)
  where defensive_contribution is not null;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0004_chat_history.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Chat history for /chat (persisted per browser session UUID).
-- Access only via Next.js API using the service-role client (RLS has no anon policies).

create table if not exists public.chat_sessions (
  id uuid primary key,
  entry_id integer,
  locale text,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  idx integer not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_uses jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, idx)
);

create index if not exists chat_messages_session_idx on public.chat_messages (session_id);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0005_fpl_season_scoping.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0006_fpl_seasons_list_view.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- Read-only helper for the chat "list seasons" tool (distinct seasons in DB).
create or replace view public.fpl_seasons_list as
select distinct season
from public.fixtures
union
select distinct season
from public.player_gw_stats
order by season desc;


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0009_wc_fantasy.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- FIFA World Cup 2026 fantasy helper tables (projected FDR / xP in-app).

create table if not exists public.wc_teams (
  id              serial primary key,
  code            text not null unique,
  name            text not null,
  short_name      text not null,
  group_letter    text not null,
  attack_strength integer not null default 50,
  defence_strength integer not null default 50,
  fifa_rank       integer,
  updated_at      timestamptz default now()
);

create table if not exists public.wc_matchdays (
  id            integer primary key,
  name          text,
  is_current    boolean default false,
  is_next       boolean default false,
  deadline_time timestamptz,
  updated_at    timestamptz default now()
);

create table if not exists public.wc_fixtures (
  id              serial primary key,
  matchday        integer not null references public.wc_matchdays (id),
  home_team_id    integer not null references public.wc_teams (id),
  away_team_id    integer not null references public.wc_teams (id),
  kickoff_time    timestamptz,
  finished        boolean default false,
  home_score      integer,
  away_score      integer,
  updated_at      timestamptz default now()
);

create index if not exists wc_fixtures_matchday_idx on public.wc_fixtures (matchday);
create index if not exists wc_fixtures_home_idx on public.wc_fixtures (home_team_id);
create index if not exists wc_fixtures_away_idx on public.wc_fixtures (away_team_id);

create table if not exists public.wc_players (
  id              serial primary key,
  wc_team_id      integer not null references public.wc_teams (id),
  name            text not null,
  fpl_id          integer references public.players_static (fpl_id),
  position        text not null,
  price           numeric(4,1),
  goals           integer default 0,
  assists         integer default 0,
  xg              numeric(6,2) default 0,
  xa              numeric(6,2) default 0,
  form            numeric(5,2) default 0,
  minutes         integer default 0,
  updated_at      timestamptz default now()
);

create index if not exists wc_players_team_idx on public.wc_players (wc_team_id);
create index if not exists wc_players_fpl_idx on public.wc_players (fpl_id);
create index if not exists wc_players_position_idx on public.wc_players (position);


-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 0010_wc_fifa_players.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

alter table public.wc_players
  add column if not exists fifa_element_id integer;

alter table public.wc_players
  add column if not exists source text default 'seed';

create unique index if not exists wc_players_fifa_element_id_uidx
  on public.wc_players (fifa_element_id)
  where fifa_element_id is not null;

create index if not exists wc_players_source_idx on public.wc_players (source);

