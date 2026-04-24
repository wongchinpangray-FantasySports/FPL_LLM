# Deploy FPL LLM (share with testers)

The app is a **Next.js 14** project in this `web/` folder. The simplest host for sharing is **[Vercel](https://vercel.com)** (free tier is enough to start).

## GitHub monorepo layout

Push the **whole repo** (e.g. `FPL_LLM`) to GitHub — not only `web/`. Typical layout:

```text
FPL_LLM/
├── web/                 ← Next.js app — this is Vercel’s Root Directory
│   ├── package.json
│   ├── app/
│   └── ...
├── supabase/
├── data_sync/
└── ...
```

**Vercel must use `web` as the app root**, otherwise build looks for `package.json` at the repo root and fails.

### Vercel + GitHub (monorepo steps)

1. Create a repo on GitHub and push **`FPL_LLM`** (or connect existing remote).
2. [vercel.com/new](https://vercel.com/new) → **Add GitHub** / install the Vercel GitHub app if asked → **Import** your repository.
3. On **Configure Project**, open **Root Directory** → **Edit** → set **`web`** → **Continue**.  
   You should see Framework **Next.js** and **Root Directory** showing `web`.
4. Add **Environment Variables** (table below) for **Production** (and **Preview** if you use PR previews).
5. **Deploy**.

Later deploys: every push to the tracked branch redeploys; only files under `web/` matter for the Next build (other folders are ignored unless you add scripts that use them).

### CLI from a monorepo clone

Always run Vercel from inside **`web/`** so the project is linked correctly:

```bash
cd web
vercel link    # first time: select scope, link to existing project or create
vercel --prod
```

## Prerequisite: environment variables

Set these in the Vercel project (**Settings → Environment Variables**). Use **Production** (and **Preview** if you want branch previews).

| Variable | Required | Notes |
|----------|----------|--------|
| `GEMINI_API_KEY` | **Yes** | From [Google AI Studio](https://aistudio.google.com/apikey). Same as `GOOGLE_API_KEY` if you prefer that name. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash` in code. Override if you use another model id. |
| `SUPABASE_URL` | **Yes** | Project URL from Supabase dashboard. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Server only.** Never expose in client code. Lets API routes read `players_static`, fixtures, etc. |
| `UPSTASH_REDIS_REST_URL` | No | If set with token, enables chat rate limiting (~20 req/min per IP). |
| `UPSTASH_REDIS_REST_TOKEN` | No | Pair with the URL above. |

Optional fallbacks (only if you don’t use service role — less capable):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — see `lib/supabase.ts`.

Do **not** commit `.env.local`; it is gitignored.

## Deploy on Vercel (summary)

If you already followed **GitHub monorepo steps** above, you’re done. Otherwise:

1. Import the Git repo on Vercel.
2. Set **Root Directory** to **`web`** for a monorepo; leave it **empty** only if the Git repo *is* just the `web` folder.
3. Add env vars → **Deploy**.

After deploy, share **`https://<project>.vercel.app`** (or your custom domain).

### Custom domain (optional)

In the project → **Settings → Domains** → add your domain and follow DNS instructions.

## Smoke test after deploy

- Open `/` — home loads.
- Open `/chat` — send a message (uses Gemini + quota).
- Open `/dashboard/[your-entry-id]` — needs Supabase data synced.
- `/planner/[entry-id]` — same.

## Costs to expect

- **Vercel**: Hobby tier includes generous bandwidth for a small test group.
- **Gemini**: Billed / limited by Google (free tier is small; paid avoids hard stops).
- **Supabase**: Within your project limits.

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| Chat returns quota / API errors | `GEMINI_API_KEY`, billing/quota in Google AI Studio. |
| Dashboard / planner “couldn’t load” | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; DB has data. |
| Build fails on Vercel | Root Directory must be **`web`** if the repo root is the monorepo. |
| Rate limit for everyone | Configure Upstash vars or temporarily rely on Gemini-side limits only. |

## Deploy without Git (CLI)

```bash
cd web
npm i -g vercel
vercel login
vercel
```

Link the project, set env vars when prompted or in the dashboard, then `vercel --prod`.

---

**Security:** The service role key is powerful — keep it only in server env vars on Vercel, never in the browser or public repos.
