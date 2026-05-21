-- Mini fantasy: 5-player squads keyed by FPL entry ID + gameweek.
-- Last submit before official deadline wins; upsert on (entry_id, gw, season).

create table if not exists public.mini_entries (
  entry_id        integer not null,
  gw              integer not null,
  season          text not null,
  entry_name      text,
  picks           jsonb not null,
  captain_fpl_id  integer not null,
  vice_fpl_id     integer not null,
  updated_at      timestamptz not null default now(),
  primary key (entry_id, gw, season)
);

create index if not exists mini_entries_gw_season_idx
  on public.mini_entries (gw, season);

create index if not exists mini_entries_season_gw_updated_idx
  on public.mini_entries (season, gw, updated_at desc);
