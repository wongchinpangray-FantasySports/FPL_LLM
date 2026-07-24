-- Per-user FPL browser session for authenticated /my-team/ sync.
-- No RLS policies: only service role (API routes) may read/write.

create table if not exists public.user_fpl_credentials (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  session_cookie text not null,
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.user_fpl_credentials enable row level security;

comment on table public.user_fpl_credentials is
  'Encrypted or trimmed FPL Cookie header per user; never exposed to clients.';
