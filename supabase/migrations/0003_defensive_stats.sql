-- 2025/26 FPL defensive stats + defensive-contribution scoring.
-- Season-level columns on players_static ------------------------------------
alter table public.players_static add column if not exists goals_conceded                 integer;
alter table public.players_static add column if not exists expected_goals_conceded        numeric(7,3);
alter table public.players_static add column if not exists saves                          integer;
alter table public.players_static add column if not exists clearances_blocks_interceptions integer;
alter table public.players_static add column if not exists recoveries                     integer;
alter table public.players_static add column if not exists tackles                        integer;
alter table public.players_static add column if not exists defensive_contribution         integer;
alter table public.players_static add column if not exists defensive_contribution_per_90  numeric(7,3);
alter table public.players_static add column if not exists goals_conceded_per_90          numeric(7,3);
alter table public.players_static add column if not exists expected_goals_conceded_per_90 numeric(7,3);
alter table public.players_static add column if not exists saves_per_90                   numeric(7,3);
alter table public.players_static add column if not exists starts                         integer;
alter table public.players_static add column if not exists starts_per_90                  numeric(7,3);

-- Per-GW additions ---------------------------------------------------------
alter table public.player_gw_stats add column if not exists clearances_blocks_interceptions integer;
alter table public.player_gw_stats add column if not exists recoveries                      integer;
alter table public.player_gw_stats add column if not exists tackles                         integer;
alter table public.player_gw_stats add column if not exists defensive_contribution          integer;
alter table public.player_gw_stats add column if not exists starts                          integer;

create index if not exists player_gw_stats_dc_idx
  on public.player_gw_stats (defensive_contribution)
  where defensive_contribution is not null;
