-- Read-only helper for the chat "list seasons" tool (distinct seasons in DB).
create or replace view public.fpl_seasons_list as
select distinct season
from public.fixtures
union
select distinct season
from public.player_gw_stats
order by season desc;
