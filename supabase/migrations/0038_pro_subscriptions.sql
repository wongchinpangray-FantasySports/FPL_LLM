-- FALEAGUE PRO sales pipeline: WeChat leads → payment → delivery / access grant.

create table if not exists public.pro_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  wechat_id          text not null,
  email              text not null,
  user_id            uuid,
  needs_signup       boolean not null default false,

  sku                text not null default 'founder_pack'
                     check (sku in ('gw_note', 'founder_pack', 'addon', 'other')),
  price_cny          integer not null default 0 check (price_cny >= 0),
  amount_collected_cny integer check (amount_collected_cny is null or amount_collected_cny >= 0),

  -- lead → contacted → paid → fulfilled | lost
  status             text not null default 'lead'
                     check (status in ('lead', 'contacted', 'paid', 'fulfilled', 'lost')),

  notes              text,
  gameweek           integer,
  notes_delivered    integer not null default 0 check (notes_delivered >= 0),
  expires_at         timestamptz,

  contacted_at       timestamptz,
  paid_at            timestamptz,
  fulfilled_at       timestamptz,
  lost_at            timestamptz,
  lost_reason        text,

  source             text not null default 'pro_claim'
                     check (source in ('pro_claim', 'manual', 'wechat_dm', 'xhs', 'other'))
);

create index if not exists pro_subscriptions_status_idx
  on public.pro_subscriptions (status, created_at desc);

create index if not exists pro_subscriptions_created_idx
  on public.pro_subscriptions (created_at desc);

create index if not exists pro_subscriptions_email_idx
  on public.pro_subscriptions (lower(email));

create index if not exists pro_subscriptions_wechat_idx
  on public.pro_subscriptions (wechat_id);

create index if not exists pro_subscriptions_user_idx
  on public.pro_subscriptions (user_id)
  where user_id is not null;

alter table public.pro_subscriptions enable row level security;

grant select, insert, update, delete on public.pro_subscriptions to service_role;
