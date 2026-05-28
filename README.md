# FALEAGUE AI

An AI analyst for Fantasy Premier League. A Next.js web app powered by an
LLM (Gemini by default, free tier) that chats about FPL, recommends captains
and transfers, and understands your own squad once you paste your FPL Entry
ID.

```
User  ──►  Next.js app (Vercel)  ──►  Google Gemini
                 │                         │
                 ├── tools (TS) ───────────┘  (tool-use loop)
                 ▼
          Supabase Postgres
                 ▲
                 │
   Scheduled Python sync jobs (GitHub Actions)
   ├─ FPL bootstrap-static  (players, teams, gameweeks)
   ├─ FPL fixtures
   ├─ FPL event/{gw}/live   (per-player GW points)
   ├─ FPL element-summary   (per-player history)
   └─ Understat             (xG, xA)
```

## Repository layout

```
FPL_LLM/
  data_sync/                 Python data-sync jobs (schedule via GH Actions)
  supabase/migrations/       SQL migrations
  web/                       Next.js 14 app (TypeScript + Tailwind)
  miniprogram/               WeChat 小程序 (native home + web-view 打开线上 H5)
  .github/workflows/         Daily + live cron workflows
  .env.example               Env vars for Python jobs & Next.js
  requirements.txt           Python deps
```

## Prerequisites

- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free tier, no card required)
- Python 3.11+ and Node 18+ locally
- (Optional) [Upstash Redis](https://upstash.com) for rate limiting
- (Recommended) A [Vercel](https://vercel.com) account for hosting the web app

## 1. Configure Supabase

1. Create a new Supabase project.
2. Open the SQL editor and paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Run it. Rerunning is safe — the migration is idempotent.
3. Run [`supabase/migrations/0005_fpl_season_scoping.sql`](supabase/migrations/0005_fpl_season_scoping.sql)
   as well (adds `season` to `fixtures` / `player_gw_stats`, `fpl_meta` for the
   active campaign). **Re-run your Python syncs** after this so rows include
   the correct `season` (see the Python sync section below).
4. Run [`supabase/migrations/0006_fpl_seasons_list_view.sql`](supabase/migrations/0006_fpl_seasons_list_view.sql)
   (view `fpl_seasons_list` for the **`list_fpl_seasons`** chat tool).
5. Run [`supabase/migrations/0007_mini_fantasy.sql`](supabase/migrations/0007_mini_fantasy.sql)
   (table `mini_entries` for the **Mini 5** page at `/mini`).
6. If GitHub Actions sync fails with **“Could not find table fpl_meta”**, run
   [`0005_fpl_season_scoping.sql`](supabase/migrations/0005_fpl_season_scoping.sql)
   (full season support) or at minimum
   [`0008_ensure_fpl_meta.sql`](supabase/migrations/0008_ensure_fpl_meta.sql).
7. Run [`supabase/migrations/0009_wc_fantasy.sql`](supabase/migrations/0009_wc_fantasy.sql)
   (World Cup fantasy tables for `/worldcup`; seeded automatically on first visit).
8. Run [`supabase/migrations/0010_wc_fifa_players.sql`](supabase/migrations/0010_wc_fifa_players.sql)
   (FIFA element id + player source for full-pool sync).
9. Grab `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the public
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API.

## 2. Set up Python data-sync locally

```bash
python -m venv .venv
.venv\Scripts\activate    # PowerShell on Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
copy .env.example .env    # then edit and fill in Supabase creds
```

Run each sync once (after migrations; order matters the first time):

```bash
python -m data_sync.sync_fpl_players
python -m data_sync.sync_fpl_fixtures
python -m data_sync.sync_fpl_player_history
python -m data_sync.sync_fpl_gw_live           # current GW only
python -m data_sync.sync_understat --season 2025
```

`sync_fpl_players` writes **`fpl_meta.current_season`** (from FPL bootstrap, or
override with env **`FPL_CURRENT_SEASON`**). Fixture and GW-stat rows carry the
same `season` so the app never mixes last year’s GW numbers with this season.

Optional env (Python + Next.js): **`FPL_CURRENT_SEASON=2025`** when you need to
pin the campaign before meta is synced or for local testing.

After this, `players_static`, `teams`, `gameweeks`, `fixtures`,
`player_gw_stats`, and `understat_xg` will be populated.

## 3. Run the web app locally

```bash
cd web
copy .env.local.example .env.local   # fill in values
npm install
npm run dev
```

Required env vars in `web/.env.local`:

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash    # or gemini-2.5-pro for higher quality
```

Optional (rate-limiting `/api/chat`):

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Open http://localhost:3000, paste an FPL Entry ID, and go to `/chat`.

### World Cup fantasy (`/worldcup`)

After migrations **0009** and **0010**, open `/worldcup`. The app seeds teams/fixtures
and builds a player pool automatically:

- **FDR** uses quintiles across all group-stage fixtures (clear 1–5 spread).
- **xP** and **Compare** use players in `wc_players` — **FIFA fantasy bootstrap first** when configured, else a small FPL seed fallback.

To reload the player pool manually: `POST /api/worldcup/sync` (FIFA first when env vars are set).

#### Full official FIFA fantasy player list (optional)

FIFA fantasy does **not** expose a public bootstrap URL like FPL. To sync the same
player list as [fantasy.fifa.com](https://fantasy.fifa.com), capture the API path from
your browser and set it on Vercel.

**Step 1 — Find the bootstrap URL (Chrome or Edge)**

1. Log in at [https://fantasy.fifa.com](https://fantasy.fifa.com) (or open the game via FIFA+ / Play Zone).
2. Open **Developer Tools** → **Network** tab.
3. Filter by **Fetch/XHR**.
4. Refresh the page or open the **Transfers / Pick team** screen so player data loads.
5. Look for a request that returns JSON with an **`elements`** array (player list), similar to FPL’s `bootstrap-static`.
   - Requests often go through `play.fifa.com/api/...` and proxy to `backend-fifa.eu.f2p.media.geniussports.com`.
6. Right-click that request → **Copy** → **Copy URL** (or copy only the path after `/api/`, e.g. `games/.../bootstrap-static`).

**Step 2 — Add env vars on Vercel**

1. Vercel → your project → **Settings** → **Environment Variables**.
2. Add:

   | Name | Value |
   |------|--------|
   | `FIFA_FANTASY_BOOTSTRAP_PATH` | Path or full URL from step 1. If you copied a full URL, paste it as-is. If you copied only the path, use e.g. `games/your-game-id/bootstrap-static` (no leading slash). |
   | `FIFA_FANTASY_GAME_ID` | (Alternative) Game id only — app will call `games/{id}/bootstrap-static` on the proxy base. |
   | `FIFA_FANTASY_AUTH_COOKIE` | (Optional) If the API only works when logged in: in Network → that request → **Headers** → copy the entire **Cookie** header value. |

3. Optional: `FIFA_FANTASY_PROXY_BASE` defaults to `https://play.fifa.com/api` — only change if your Network tab shows a different host.

The app **always tries FIFA first** when either bootstrap path or game id is set; the small FPL seed list is only used if FIFA sync fails.

4. **Redeploy** the project (Deployments → … → Redeploy) so the new variables apply.

**Step 3 — Refresh the database**

1. Run migration [`0010_wc_fifa_players.sql`](supabase/migrations/0010_wc_fifa_players.sql) on Supabase if you have not already.
2. Trigger a sync once deploy is live:

   ```bash
   curl -X POST https://faleague-ai.com/api/worldcup/sync
   ```

   Or load `/worldcup` — seed will try FIFA sync when the pool is small.

3. Open `/worldcup` → **xP heatmap** — you should see hundreds of players if the bootstrap URL is correct.

If sync fails, the app keeps the **expanded FPL fallback** pool (~200+ internationals). Check Vercel **Functions** logs for the error message.

## 4. Deploy the web app to Vercel

From the repo root:

```bash
cd web
npx vercel          # first deploy, link project
npx vercel --prod   # production deploy
```

In the Vercel project → Settings → Environment Variables, add the same vars
from `web/.env.local.example`.

`web/vercel.json` already lifts `maxDuration` for `/api/chat` so tool-use
loops with several Claude turns don't get cut off.

## 5. Schedule the Python sync jobs

Push the repo to GitHub, then in the repo **Settings → Secrets and variables
→ Actions → New repository secret**, add:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The two workflows in [.github/workflows](.github/workflows) will run
automatically:

- `sync-daily.yml` — every day at 03:00 UTC. Refreshes players, fixtures,
  player history, and Understat xG.
- `sync-live.yml` — every 5 minutes. Pulls live GW points and bootstrap
  stats (prices, form, transfers).

You can also run either manually via **Actions → Run workflow**.

## Architecture notes

- **One chat endpoint**: `web/app/api/chat/route.ts` streams from Gemini via
  Server-Sent Events. On a `functionCall`, it executes the tool handler and
  feeds the `functionResponse` back to Gemini, looping up to 6 times per
  message. Swapping to another provider (Claude, OpenAI, Groq) means
  rewriting just `lib/llm.ts` and the loop body in that one route.
- **Tools live in** `web/lib/tools/`. Each is a `ToolHandler` with a JSON
  schema + a `run()` handler. New tools just need to be added to
  `web/lib/tools/index.ts`.
- **Optimizers are deterministic TypeScript**, not LLM reasoning.
  `suggest_captain` and `suggest_transfers` produce a ranked shortlist with
  a clear score formula, and Claude narrates. This is the reliable pattern
  for agents.
- **No auth in v1**. The user's FPL Entry ID lives in `localStorage` and is
  passed on each chat request. `user_teams` caches their squad for 10 min.

## Extending

- **Telegram / Discord bot**: a ~100-line adapter that POSTs to `/api/chat`.
- **Price-change predictor**: add a nightly Python job that diffs
  `transfers_in_event - transfers_out_event` and writes to a new table; add
  a tool that reads it.
- **Fine-tuning**: not recommended for v1. Revisit only if you want a
  distinctive voice.

## License

MIT.
