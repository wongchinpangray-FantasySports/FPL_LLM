# FPL Insights Hub — Build Specification

Last updated: 2026-07-23  
Status: Phase 0 in progress

---

## 1. Product goals

### Primary
- Surface **actionable FPL analysis** from data already synced (no new pipelines for v1).
- Give users **GW1-ready prep** before the season starts (preseason signals, set-pieces, fixtures context).
- Provide a single **Insights hub** that replaces scattered research links.

### Monetisation (prepared in advance)
- Some insight pages are tagged **premium** in the catalog.
- Until billing launches, `INSIGHTS_PREMIUM_ENFORCE=false` keeps all pages free (soft paywall UI only).
- Premium pages are natural sponsor/affiliate surfaces (e.g. weekly transfer trends).

### Non-goals (v1)
- Entry-specific insights (dashboard/planner/chat).
- New third-party data sources.
- Full charting library — reuse tables + SVG sparklines.

---

## 2. Decisions log

| Question | Decision | Rationale |
|----------|----------|-----------|
| Historical auth | **Fold into Insights hub** as “Historical stats” tile; **ungate read API** in Phase 1 | Fixes broken public page; single research entry point |
| Differentials ownership cap | **5%** default | More aggressive “differential” feel |
| Preseason signals | **Ship now** for GW1 prep (not “Coming soon”) | Users need actionable data before GW1 |
| Commercial / paid | **Prepare entitlement layer** now; enforce later | See §8 |

### Historical: fold vs keep separate — impact

| Option | UX | Engineering | SEO / growth | Risk |
|--------|----|-------------|--------------|------|
| **Fold into Insights + ungate API** (chosen) | One hub; Historical becomes a tile; `/fpl/historical` URL kept as alias | Remove `requireAuthForApi` on `/api/fpl/historical/*`; add Insights nav | Stronger “research” cluster; internal linking | Slightly more public API surface — mitigate with cache + no PII |
| Keep separate + ungate API only | Two entry points; users may miss Historical | Same API change | Weaker hub story | Same API surface without UX benefit |
| Keep separate + stay gated | No change | None | **Broken UX today**: page is public in middleware but API returns 401 | Poor experience for logged-out users |

**Implementation note:** Historical page stays at `/fpl/historical` for bookmarks; Insights hub links to it. Phase 1 removes auth from historical APIs and adds SSR fallback where possible.

---

## 3. Information architecture

### Routes

```
/fpl/insights                          Hub
/fpl/insights/preseason-signals        GW1 prep (Phase 0 — live)
/fpl/insights/set-pieces               Phase 1
/fpl/insights/defcon                   Phase 1
/fpl/insights/transfers                Phase 1 (premium)
/fpl/insights/differentials            Phase 1 (premium, 5% cap)
/fpl/insights/xg-divergence            Phase 2 (premium)
/fpl/insights/fixture-swing            Phase 2 (free)
/fpl/insights/price-changes            Phase 2 (premium)
/fpl/insights/xp-accuracy              Phase 3 (premium)
/fpl/historical                        Existing — linked from hub as “Historical stats”
```

### Navigation
- `/fpl` hub: accent tile → Insights
- Site header Research: **Insights** (above Fixtures)
- Home hub research strip: add Insights link
- Insights sub-nav on all `/fpl/insights/*` pages

### Auth
- All Insights pages: **public** (`FPL_PUBLIC_PREFIXES` includes `/fpl/insights`).
- `/api/fpl/insights/*`: public read, cached.
- Premium enforcement: optional per-user (see §8).

---

## 4. Insight catalog & tiers

Defined in `web/lib/fpl/insights/catalog.ts`.

| ID | Title | Tier | Phase | Default filters |
|----|-------|------|-------|-----------------|
| `preseason-signals` | GW1 prep | free | **0** | — |
| `set-pieces` | Set-piece takers | free | 1 | — |
| `defcon` | Defcon leaders | free | 1 | min 450 min |
| `transfers` | Transfer momentum | **premium** | 1 | sort net transfers |
| `differentials` | Differentials | **premium** | 1 | **max ownership 5%** |
| `fixture-swing` | Fixture swing | free | 2 | next 8 GWs |
| `xg-divergence` | xG divergence | **premium** | 2 | — |
| `price-changes` | Price changes | **premium** | 2 | — |
| `xp-accuracy` | xP accuracy | **premium** | 3 | — |
| `historical` | Historical stats | free | 1 (ungate) | links to `/fpl/historical` |

**Affiliate / sponsor slots (premium pages):**
- `insights-sponsor-banner` component below page title on premium insights.
- Props: `sponsorName`, `sponsorHref`, `disclosure` — empty until commercial deal.
- Weekly transfer report PDF / email is a future upsell (not v1).

---

## 5. Technical architecture

### Directory layout

```
web/
  lib/fpl/insights/
    types.ts
    catalog.ts              Insight definitions + tiers
    meta.ts                 GW context, sync timestamps
    access.ts               Entitlement checks
    preseason-signals.ts    Phase 0
    transfers.ts            Phase 1
    set-pieces.ts
    defcon.ts
    differentials.ts        max_ownership default 5

  app/api/fpl/insights/
    [insight]/route.ts      JSON for client filters
    access/route.ts         Returns user plan + gated ids (optional)

  app/[locale]/fpl/insights/
    page.tsx                Hub
    preseason-signals/page.tsx
    ...

  components/fpl/insights/
    insights-hub.tsx
    insights-sub-nav.tsx
    insights-table.tsx
    insights-filter-bar.tsx
    insights-updated-banner.tsx
    insights-paywall.tsx
    insights-sponsor-banner.tsx
    insights-placeholder.tsx

supabase/migrations/
  0024_insights_entitlements.sql
```

### Data loading
1. **Prefer RSC**: page calls `loadXInsight()` directly (fixtures pattern).
2. **Client filters**: `GET /api/fpl/insights/[id]?...` with `unstable_cache`, revalidate 120–300s.
3. **Premium rows**: server strips premium data if `!canAccessInsight` when enforce flag on.

### Caching
| Layer | Revalidate |
|-------|------------|
| Live GW (`transfers`, `defcon`) | 120s |
| Preseason / set-pieces | 300s |
| Differentials (xP batch) | 300s |

---

## 6. Page specifications

### 6.1 Hub — `/fpl/insights`
- Tile grid from `INSIGHT_CATALOG`.
- Badges: `Free`, `Premium`, `Live`, `Soon`.
- Updated banner: GW, deadline, last sync.
- Featured tile: **GW1 prep** (preseason-signals) until GW3.

### 6.2 Preseason signals — `/fpl/insights/preseason-signals` (Phase 0)

**Question:** *Who scored, assisted, and started in pre-season friendlies — likely GW1 minutes?*

**Sources:** `web/data/epl-preseason-2627.json`, `loadPreseasonFplPlayerIndex()`.

**Aggregates per player:**
- Goals, assists (from match `goals[]`)
- Starts / sub apps (from `lineup` where present)
- PL club, FPL link when resolved

**Columns:** Player, Club, G, A, Starts, Subs, FPL link.

**Filters:** Club, min starts, sort by goals / starts.

### 6.3 Transfers — `/fpl/insights/transfers` (Phase 1, premium)

**Sources:** `players_static`, `player_gw_stats` (last 5 GWs).

**Columns:** Player, price, own %, Δ own, transfers in/out, net, trend sparkline.

### 6.4 Set-pieces — `/fpl/insights/set-pieces` (Phase 1, free)

**Sources:** `players_static` penalty/FK/corner orders.

### 6.5 Defcon — `/fpl/insights/defcon` (Phase 1, free)

**Sources:** `players_static.defensive_contribution`, CBI, recoveries, tackles.

### 6.6 Differentials — `/fpl/insights/differentials` (Phase 1, premium)

Extract from `web/lib/tools/players.ts` → shared `differentials.ts`.

**Defaults:** `max_ownership: 5`, `horizon: 5`, `min_minutes: 270`.

---

## 7. Phase plan

| Phase | Deliverables | Est. |
|-------|--------------|------|
| **0** (current) | Hub, catalog, access layer, migration, preseason-signals, nav, i18n | 2–3 days |
| **1** | Set-pieces, defcon, transfers, differentials; ungate historical API | 1 week |
| **2** | xG divergence, fixture swing, price changes | 1–2 weeks |
| **3** | xP accuracy, Stripe wiring, enforce premium | 1 week |

**Build order after Phase 0:** set-pieces → defcon → transfers → differentials.

---

## 8. Premium / entitlements (prepared in advance)

### Database (`0024_insights_entitlements.sql`)
```sql
alter table public.profiles
  add column if not exists insights_plan text not null default 'free',
  add column if not exists insights_plan_expires_at timestamptz,
  add column if not exists stripe_customer_id text;
-- check: insights_plan in ('free', 'premium')
```

### Environment
| Variable | Default | Purpose |
|----------|---------|---------|
| `INSIGHTS_PREMIUM_ENFORCE` | `false` | When `true`, premium pages require `insights_plan=premium` |
| `INSIGHTS_SPONSOR_NAME` | — | Optional sponsor label on premium pages |
| `INSIGHTS_SPONSOR_URL` | — | Sponsor link |

### Code (`web/lib/fpl/insights/access.ts`)
- `getUserInsightsPlan(userId)` → `'free' | 'premium'`
- `canAccessInsight(insightId, userId)` → boolean
- When enforce off: always `true` (development / launch period)

### UI
- `InsightsPaywall`: blur table preview + “Sign in” / “Upgrade to Insights Pro”
- `InsightsSponsorBanner`: disclosure + link for commercial partners
- Premium tiles show lock icon on hub when enforce on

### Future billing
- Stripe Checkout → webhook updates `profiles.insights_plan`
- Not in scope until Phase 3

---

## 9. i18n

Namespace: **`fplInsights`** in `web/messages/en.json` and `zh.json`.

Also add to `fplHub`:
- `insightsTitle`, `insightsBody`

Nav key in `nav`: `insights`

---

## 10. Testing

| Test | File |
|------|------|
| Catalog + access defaults | `web/scripts/insights-access-self-test.ts` |
| Preseason aggregation | `web/scripts/insights-preseason-self-test.ts` |
| Transfers sort (Phase 1) | `web/scripts/insights-transfers-self-test.ts` |

CI: run access + preseason self-tests on PR.

---

## 11. SEO

Each insight page: `generateMetadata` with title + description from `fplInsights.*`.

Hub targets: “FPL insights”, “GW1 prep”, “FPL transfer trends”, “FPL differentials”.

---

## 12. Open items (post Phase 0)

- [x] Ungate `/api/fpl/historical/*` (Phase 1 — done)
- [x] Stripe products for Insights Pro (Phase 3 — checkout + webhook wired; set env to enable)
- [ ] Set `INSIGHTS_PREMIUM_ENFORCE=true` when ready to gate premium pages
- [ ] Weekly transfer email / sponsor pack (commercial)
