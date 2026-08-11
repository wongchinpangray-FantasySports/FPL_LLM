-- Mini 5 gamification: guest profiles, badges, private mini-leagues.
-- Entries keep (entry_id, gw, season) PK; guests use negative entry_id derived from profile_id.

create table if not exists public.mini_profiles (
  id            text primary key,
  nickname      text not null,
  fpl_entry_id  integer,
  badges        jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mini_profiles_nickname_len check (char_length(trim(nickname)) between 2 and 24)
);

create unique index if not exists mini_profiles_fpl_entry_id_uidx
  on public.mini_profiles (fpl_entry_id)
  where fpl_entry_id is not null;

alter table public.mini_entries
  add column if not exists profile_id text references public.mini_profiles (id);

create index if not exists mini_entries_profile_season_idx
  on public.mini_entries (profile_id, season);

create table if not exists public.mini_leagues (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  name        text not null,
  season      text not null,
  created_by  text references public.mini_profiles (id),
  created_at  timestamptz not null default now(),
  constraint mini_leagues_code_len check (char_length(code) between 4 and 12),
  constraint mini_leagues_name_len check (char_length(trim(name)) between 2 and 40)
);

create unique index if not exists mini_leagues_season_code_uidx
  on public.mini_leagues (season, lower(code));

create table if not exists public.mini_league_members (
  league_id   uuid not null references public.mini_leagues (id) on delete cascade,
  profile_id  text not null references public.mini_profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (league_id, profile_id)
);

create index if not exists mini_league_members_profile_idx
  on public.mini_league_members (profile_id);

alter table public.mini_profiles enable row level security;
alter table public.mini_leagues enable row level security;
alter table public.mini_league_members enable row level security;
