-- Account personalization: login-day counter and theme source preference.

alter table public.profiles
  add column if not exists login_days integer not null default 0,
  add column if not exists last_login_date date,
  add column if not exists theme_team_type text not null default 'club'
    check (theme_team_type in ('club', 'national'));
