-- Adds set-piece / penalty order fields from FPL bootstrap-static.
-- Low values (1) = primary taker. NULL = no known duty.
alter table public.players_static add column if not exists penalties_order                   integer;
alter table public.players_static add column if not exists direct_freekicks_order            integer;
alter table public.players_static add column if not exists corners_and_indirect_freekicks_order integer;
alter table public.players_static add column if not exists penalties_text                    text;
alter table public.players_static add column if not exists direct_freekicks_text             text;
alter table public.players_static add column if not exists corners_and_indirect_freekicks_text text;

create index if not exists players_static_pens_idx
  on public.players_static (penalties_order)
  where penalties_order is not null;
