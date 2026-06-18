-- User accounts, onboarding preferences, and in-app notification mailbox.

create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  display_name            text,
  fpl_entry_id            integer unique,
  onboarding_completed_at timestamptz,
  locale                  text default 'en',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  national_team_code      text,
  favorite_leagues        text[] not null default '{}',
  fpl_team_id             integer references public.teams (id),
  followed_fpl_player_ids integer[] not null default '{}',
  followed_wc_player_ids  integer[] not null default '{}',
  news_regions            text[] not null default '{GLOBAL}',
  updated_at              timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null default 'news',
  title       text not null,
  body        text,
  href        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on public.user_notifications (user_id)
  where read_at is null;

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_notifications enable row level security;

create policy "profiles select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "user_preferences select own"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences insert own"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences update own"
  on public.user_preferences for update
  using (auth.uid() = user_id);

create policy "user_notifications select own"
  on public.user_notifications for select
  using (auth.uid() = user_id);

create policy "user_notifications update own"
  on public.user_notifications for update
  using (auth.uid() = user_id);
