-- Allow PRO sample open/download events (funnel: sample → lead → paid).
-- Path stores the sample asset path, e.g. /pro/samples/gw4-sample-a-19.pdf

alter table public.site_events
  drop constraint if exists site_events_event_type_check;

alter table public.site_events
  add constraint site_events_event_type_check
  check (event_type in ('pageview', 'pro_sample'));

create index if not exists site_events_type_created_idx
  on public.site_events (event_type, created_at desc);
