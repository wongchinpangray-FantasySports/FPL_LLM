-- Cached World Cup news/editorial RSS items (synced from GitHub Actions or live fetch).

create table if not exists public.wc_news_cache (
  id         text primary key default 'global',
  items      jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

alter table public.wc_news_cache enable row level security;

create policy "wc_news_cache read"
  on public.wc_news_cache for select
  using (true);
