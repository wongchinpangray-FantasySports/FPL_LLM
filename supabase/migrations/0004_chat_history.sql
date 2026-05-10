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
