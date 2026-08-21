-- Cursor translation queue: Ray confirms in /admin, then a local script dumps
-- requested rows for the Cursor agent. Null = not requested.
-- Admin/API writes use the service role (bypasses RLS). Public remains
-- published-row SELECT only — no new policies needed.

alter table public.scout_articles
  add column if not exists translate_requested_at timestamptz;

create index if not exists scout_articles_translate_requested_idx
  on public.scout_articles (translate_requested_at)
  where translate_requested_at is not null;
