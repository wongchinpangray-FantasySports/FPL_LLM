-- Daily FPL morning briefings (00:00–12:00 Europe/London), AI-generated from X/news sources.

create table if not exists public.fpl_x_digests (
  digest_date          date primary key,
  window_start         timestamptz not null,
  window_end           timestamptz not null,
  summary_json         jsonb not null default '{}'::jsonb,
  source_items         jsonb not null default '[]'::jsonb,
  source_fingerprint   text not null default '',
  model                text,
  generated_at         timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists fpl_x_digests_generated_at_idx
  on public.fpl_x_digests (generated_at desc);

alter table public.fpl_x_digests enable row level security;

create policy "fpl_x_digests read"
  on public.fpl_x_digests for select
  using (true);
