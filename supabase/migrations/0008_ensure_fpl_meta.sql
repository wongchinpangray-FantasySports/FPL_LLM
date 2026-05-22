-- Idempotent: creates fpl_meta if migration 0005 was skipped.
-- Safe to run on any project that already has base tables from 0001.

create table if not exists public.fpl_meta (
  key          text primary key,
  value        text not null,
  updated_at   timestamptz default now()
);

insert into public.fpl_meta (key, value)
values ('current_season', '2025')
on conflict (key) do nothing;
