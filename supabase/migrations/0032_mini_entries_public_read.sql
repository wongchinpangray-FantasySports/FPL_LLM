-- Mini 5 squads are public leaderboard data (nicknames + picks).
-- Allow read via anon key so API routes still work if SERVICE_ROLE_KEY is missing.

do $$
begin
  if to_regclass('public.mini_entries') is null then
    return;
  end if;

  execute 'alter table public.mini_entries enable row level security';

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mini_entries'
      and policyname = 'mini_entries read'
  ) then
    execute $policy$
      create policy "mini_entries read"
      on public.mini_entries
      for select
      using (true)
    $policy$;
  end if;
end $$;
