-- Allow sharing a manager season snapshot (/manager/:entryId).

alter table public.share_links drop constraint if exists share_links_kind_check;

alter table public.share_links add constraint share_links_kind_check
  check (kind in (
    'price_forecast',
    'insight',
    'scout_article',
    'player',
    'mini_leaderboard',
    'manager'
  ));
