-- Per-GW Mini 5 badge events (accumulated across gameweeks).

create table if not exists mini_badge_events (
  id            uuid primary key default gen_random_uuid(),
  profile_id    text not null references mini_profiles(id) on delete cascade,
  badge_id      text not null,
  gw            integer,
  season        text not null,
  unlocked_at   timestamptz not null default now()
);

-- One-time badges (no GW): first_squad, template_starter, league_joiner
create unique index if not exists mini_badge_events_once_uidx
  on mini_badge_events (profile_id, badge_id, season)
  where gw is null;

-- Repeatable per-GW badges: gw_ready, hot_captain, diff_captain, mission_complete
create unique index if not exists mini_badge_events_gw_uidx
  on mini_badge_events (profile_id, badge_id, gw, season)
  where gw is not null;

create index if not exists mini_badge_events_season_profile_idx
  on mini_badge_events (season, profile_id);

alter table mini_badge_events enable row level security;
