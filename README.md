# FPL LLM

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
3. Grab `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the public
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API.

## 2. Set up Python data-sync locally

```bash
python -m venv .venv
.venv\Scripts\activate    # PowerShell on Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r requirements.txt
copy .env.example .env    # then edit and fill in Supabase creds
```

Run each sync once:

```bash
python -m data_sync.sync_fpl_players
python -m data_sync.sync_fpl_fixtures
python -m data_sync.sync_fpl_player_history
python -m data_sync.sync_fpl_gw_live           # current GW only
python -m data_sync.sync_understat --season 2025
```

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
