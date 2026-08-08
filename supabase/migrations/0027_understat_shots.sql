-- Understat per-shot locations (pitch x/y + xG) for player shot maps.
-- Populated by data_sync.sync_understat from match-page shotsData.

create table if not exists public.understat_shots (
  id                 bigserial primary key,
  understat_shot_id  text not null,
  understat_player_id text,
  player_name        text not null,
  team               text,
  opponent           text,
  season             text not null,
  match_id           text not null,
  match_date         date,
  minute             integer,
  -- Understat pitch coords in [0, 1]: X toward attacking goal, Y left–right.
  x                  numeric(6,4) not null,
  y                  numeric(6,4) not null,
  xg                 numeric(8,5),
  result             text,
  shot_type          text,
  situation          text,
  h_a                text check (h_a in ('h', 'a')),
  matched_fpl_id     integer references public.players_static (fpl_id),
  updated_at         timestamptz default now(),
  unique (understat_shot_id)
);

create index if not exists understat_shots_fpl_idx
  on public.understat_shots (matched_fpl_id, match_date desc);
create index if not exists understat_shots_player_idx
  on public.understat_shots (understat_player_id, season);
create index if not exists understat_shots_match_idx
  on public.understat_shots (match_id);

alter table public.understat_shots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'understat_shots'
      and policyname = 'understat_shots read'
  ) then
    create policy "understat_shots read"
      on public.understat_shots
      for select
      using (true);
  end if;
end $$;
