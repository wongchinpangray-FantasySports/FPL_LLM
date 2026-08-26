-- Site activity monitoring: first-party pageviews for the admin dashboard.
-- Distinct from scout_events (FFS trial scorecard only).

create table if not exists public.site_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  event_type  text not null default 'pageview'
              check (event_type in ('pageview')),
  path        text not null,
  feature     text not null,
  visitor_id  text,
  user_id     uuid,
  referrer    text
);

create index if not exists site_events_created_at_idx
  on public.site_events (created_at desc);

create index if not exists site_events_feature_created_idx
  on public.site_events (feature, created_at desc);

create index if not exists site_events_visitor_created_idx
  on public.site_events (visitor_id, created_at desc)
  where visitor_id is not null;

create index if not exists site_events_user_created_idx
  on public.site_events (user_id, created_at desc)
  where user_id is not null;

alter table public.site_events enable row level security;

-- Service role only (no anon policies). Inserts go through Next.js API.
