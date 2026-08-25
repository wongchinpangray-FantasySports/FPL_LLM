-- Mini League Killer closed beta: invite tokens, 5-GW trial windows, tester feedback.

create table if not exists public.mini_league_beta_invites (
  id               uuid primary key default gen_random_uuid(),
  email            text,
  fpl_entry_id     integer,
  token            text unique not null,
  invited_by       uuid,
  start_event      integer,
  end_event        integer,
  duration_events  integer not null default 5
                   check (duration_events >= 1 and duration_events <= 38),
  claimed_by       uuid,
  claimed_at       timestamptz,
  status           text not null default 'pending'
                   check (status in ('pending', 'active', 'expired', 'revoked')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists mini_league_beta_invites_token_idx
  on public.mini_league_beta_invites (token);

create index if not exists mini_league_beta_invites_email_idx
  on public.mini_league_beta_invites (email)
  where email is not null;

create index if not exists mini_league_beta_invites_claimed_by_idx
  on public.mini_league_beta_invites (claimed_by)
  where claimed_by is not null;

create index if not exists mini_league_beta_invites_status_idx
  on public.mini_league_beta_invites (status, created_at desc);

create table if not exists public.mini_league_feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  email         text,
  fpl_entry_id  integer,
  gameweek      integer,
  tool_id       text,
  rating        integer
                check (rating is null or (rating >= 1 and rating <= 5)),
  body          text not null,
  created_at    timestamptz not null default now()
);

create index if not exists mini_league_feedback_created_at_idx
  on public.mini_league_feedback (created_at desc);

create index if not exists mini_league_feedback_user_idx
  on public.mini_league_feedback (user_id, created_at desc)
  where user_id is not null;

alter table public.mini_league_beta_invites enable row level security;
alter table public.mini_league_feedback enable row level security;

grant select, insert, update on public.mini_league_beta_invites to service_role;
grant select, insert on public.mini_league_feedback to service_role;
