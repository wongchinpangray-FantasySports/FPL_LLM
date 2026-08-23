-- Short share links: QR / copy URL landing pages with one guest preview per visitor.

create table if not exists public.share_links (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  kind         text not null
               check (kind in (
                 'price_forecast',
                 'insight',
                 'scout_article',
                 'player',
                 'mini_leaderboard'
               )),
  target_path  text not null,
  title        text not null default '',
  ref_id       text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  unique (kind, target_path)
);

create index if not exists share_links_code_idx on public.share_links (code);

create table if not exists public.share_views (
  share_id      uuid not null references public.share_links(id) on delete cascade,
  visitor_id    text not null,
  first_seen_at timestamptz not null default now(),
  primary key (share_id, visitor_id)
);

alter table public.share_links enable row level security;
alter table public.share_views enable row level security;

grant select, insert, update on public.share_links to service_role;
grant select, insert on public.share_views to service_role;
