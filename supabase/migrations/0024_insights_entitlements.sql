-- Insights Pro entitlements (billing wired in Phase 3; columns ready now).

alter table public.profiles
  add column if not exists insights_plan text not null default 'free',
  add column if not exists insights_plan_expires_at timestamptz,
  add column if not exists stripe_customer_id text;

alter table public.profiles drop constraint if exists profiles_insights_plan_check;
alter table public.profiles
  add constraint profiles_insights_plan_check
  check (insights_plan in ('free', 'premium'));

create index if not exists profiles_insights_plan_idx
  on public.profiles (insights_plan)
  where insights_plan = 'premium';
