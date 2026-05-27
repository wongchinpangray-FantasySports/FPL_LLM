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
