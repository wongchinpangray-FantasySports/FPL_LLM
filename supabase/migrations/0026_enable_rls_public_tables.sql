-- Supabase security advisor: tables in public without RLS are readable/writable
-- by anyone holding the project URL + anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY).
--
-- Safe to run on any project state: skips tables that do not exist yet.
-- Server sync jobs and Next.js API routes use the service role and bypass RLS.

do $$
declare
  t text;
  read_only_tables text[] := array[
    'players_static',
    'teams',
    'gameweeks',
    'fixtures',
    'player_gw_stats',
    'understat_xg',
    'fpl_meta',
    'player_season_profiles',
    'wc_teams',
    'wc_matchdays',
    'wc_fixtures',
    'wc_players',
    'wc_match_stats',
    'wc_news_cache',
    'fpl_x_digests'
  ];
  service_only_tables text[] := array[
    'user_teams',
    'mini_entries',
    'wc_mini_entries',
    'user_fpl_credentials',
    'chat_sessions',
    'chat_messages'
  ];
  policy_name text;
begin
  foreach t in array read_only_tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    policy_name := t || ' read';

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for select using (true)',
        policy_name,
        t
      );
    end if;
  end loop;

  foreach t in array service_only_tables loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
