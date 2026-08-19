-- Persist Squad Builder drafts per signed-in account (cross-device / re-login).

create table if not exists public.user_squad_builder_drafts (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  draft      jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table public.user_squad_builder_drafts is
  'Squad Builder comparison drafts (version 3 JSON) for each Faleague account.';

alter table public.user_squad_builder_drafts enable row level security;

create policy "user_squad_builder_drafts select own"
  on public.user_squad_builder_drafts for select
  using (auth.uid() = user_id);

create policy "user_squad_builder_drafts insert own"
  on public.user_squad_builder_drafts for insert
  with check (auth.uid() = user_id);

create policy "user_squad_builder_drafts update own"
  on public.user_squad_builder_drafts for update
  using (auth.uid() = user_id);

create policy "user_squad_builder_drafts delete own"
  on public.user_squad_builder_drafts for delete
  using (auth.uid() = user_id);
