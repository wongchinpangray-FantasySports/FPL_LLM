-- World Cup Mini 5: five-player squads keyed by entry tag + matchday.

create table if not exists public.wc_mini_entries (
  entry_tag         text not null,
  matchday          integer not null,
  season            text not null default '2026',
  entry_name        text,
  picks             jsonb not null,
  captain_player_id integer not null,
  vice_player_id    integer not null,
  updated_at        timestamptz not null default now(),
  primary key (entry_tag, matchday, season)
);

create index if not exists wc_mini_entries_md_season_idx
  on public.wc_mini_entries (matchday, season);

create index if not exists wc_mini_entries_season_md_updated_idx
  on public.wc_mini_entries (season, matchday, updated_at desc);
