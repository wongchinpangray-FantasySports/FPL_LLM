-- Cached World Cup match rows + optional team stats (API-Football / Opta-style).

create table if not exists public.wc_match_stats (
  fifa_tournament_id integer primary key,
  round_id           integer not null,
  kickoff            timestamptz,
  venue              text,
  venue_city         text,
  status             text not null default 'scheduled',
  period             text,
  minutes            integer not null default 0,
  extra_minutes      integer not null default 0,
  home_code          text not null,
  away_code          text not null,
  home_name          text not null,
  away_name          text not null,
  home_score         integer,
  away_score         integer,
  home_scorers       text,
  away_scorers       text,
  home_stats         jsonb,
  away_stats         jsonb,
  stats_source       text,
  updated_at         timestamptz default now()
);

create index if not exists wc_match_stats_round_idx
  on public.wc_match_stats (round_id);

create index if not exists wc_match_stats_status_idx
  on public.wc_match_stats (status);

create index if not exists wc_match_stats_stats_null_idx
  on public.wc_match_stats (fifa_tournament_id)
  where home_stats is null;
