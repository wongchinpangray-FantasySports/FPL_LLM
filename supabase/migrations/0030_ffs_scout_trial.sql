-- FFS China trial: localised Scout articles + performance events.
-- Ingested rows default to `pending`. Public pages only read `published`.

create table if not exists public.scout_articles (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  source_guid         text unique not null,
  source_url          text not null,
  title_en            text not null,
  title_zh            text not null default '',
  excerpt_en          text,
  excerpt_zh          text,
  author              text,
  categories          text[] not null default '{}',
  series              text not null default 'other',
  hero_image_url      text,
  images              jsonb not null default '[]'::jsonb,
  body_html_en        text,
  body_html_zh        text,
  content_hash        text,
  status              text not null default 'pending'
                      check (status in ('pending', 'published', 'hidden')),
  source_published_at timestamptz,
  translated_at       timestamptz,
  pushed_at           timestamptz,
  translation_model   text,
  translation_error   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists scout_articles_status_published_idx
  on public.scout_articles (status, source_published_at desc);

create index if not exists scout_articles_series_idx
  on public.scout_articles (series);

create table if not exists public.scout_events (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  event_type  text not null
              check (event_type in (
                'pageview',
                'click_premium',
                'click_team_rater',
                'click_original',
                'click_qr'
              )),
  article_id  uuid references public.scout_articles (id) on delete set null,
  slug        text,
  visitor_id  text,
  user_id     uuid,
  referrer    text,
  path        text,
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists scout_events_created_at_idx
  on public.scout_events (created_at desc);

create index if not exists scout_events_type_created_idx
  on public.scout_events (event_type, created_at desc);

create index if not exists scout_events_article_type_idx
  on public.scout_events (article_id, event_type);

create table if not exists public.scout_distribution_logs (
  id          uuid primary key default gen_random_uuid(),
  logged_at   timestamptz not null default now(),
  channel     text not null
              check (channel in ('wechat', 'xhs', 'twitter', 'other')),
  note        text,
  article_id  uuid references public.scout_articles (id) on delete set null,
  created_by  text
);

create index if not exists scout_distribution_logs_logged_at_idx
  on public.scout_distribution_logs (logged_at desc);

alter table public.scout_articles enable row level security;
alter table public.scout_events enable row level security;
alter table public.scout_distribution_logs enable row level security;

drop policy if exists "scout_articles public published read" on public.scout_articles;
create policy "scout_articles public published read"
  on public.scout_articles
  for select
  using (status = 'published');

-- Events + distribution logs: service role only (no anon policies).
