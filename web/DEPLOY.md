# Deploy FALEAGUE AI (share with testers)

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
| `CLOUDFLARE_AI_GATEWAY_NAME` | No | **Cloudflare Workers (recommended):** AI Gateway **name** only — with repo `wrangler.jsonc` **`ai` binding**, the app resolves the gateway URL at runtime. Aliases: `CF_AI_GATEWAY_NAME`. |
| `GEMINI_AI_GATEWAY_BASE_URL` | No | **Workers alternative:** full Google AI Studio gateway base URL (no trailing slash). Alias: `CF_AI_GATEWAY_GEMINI_BASE_URL`. Or set `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_AI_GATEWAY_NAME`. |
| `FIFA_FANTASY_BOOTSTRAP_PATH` | No | Full URL or path to FIFA player JSON (from browser Network tab). |
| `FIFA_FANTASY_AUTH_COOKIE` | No (Secret) | Trimmed session cookie if required. **Max ~5 KiB on Workers** — if Cloudflare rejects the secret, store the full cookie in Supabase `fpl_meta` key `fifa_fantasy_auth_cookie` instead (see root `README.md`). |
| `GEMINI_AI_GATEWAY_TOKEN` | No | If the AI Gateway requires auth: token for `cf-aig-authorization`. Alias: `CF_AIG_AUTHORIZATION`. |
| `SUPABASE_URL` | **Yes** | Project URL from Supabase dashboard. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | **Server only.** Never expose in client code. Lets API routes read `players_static`, fixtures, etc. |
| `UPSTASH_REDIS_REST_URL` | No | If set with token, enables chat rate limiting (~20 req/min per IP). |
| `UPSTASH_REDIS_REST_TOKEN` | No | Pair with the URL above. |
| `API_FOOTBALL_KEY` | No | **Recommended for pre-season + WC live scores.** Same [API-Sports](https://www.api-football.com/) key as repo secret `API_FOOTBALL_KEY` used by GitHub Actions sync. Set on **Cloudflare Workers** (or Vercel) so `/fpl/preseason` can fetch same-day friendly results at page load — the PL article often lags by a day. |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical public URL (e.g. `https://www.faleague-ai.com`) for Supabase password-reset emails. |

Optional fallbacks (only if you don’t use service role — less capable):

- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — see `lib/supabase.ts`.

Do **not** commit `.env.local`; it is gitignored.

## Deploy on Vercel (summary)

If you already followed **GitHub monorepo steps** above, you’re done. Otherwise:

1. Import the Git repo on Vercel.
2. Set **Root Directory** to **`web`** for a monorepo; leave it **empty** only if the Git repo *is* just the `web` folder.
3. Add env vars → **Deploy**.

After deploy, share **`https://<project>.vercel.app`** (or your custom domain).

### Cloudflare Workers (alternative)

The same Next.js app can run on **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** via **OpenNext** (`web/open-next.config.ts`, `web/wrangler.jsonc`). The repo root also has **`wrangler.jsonc`** so Git-connected builds work when the dashboard **Root directory** is **`/`** (monorepo).

#### Git integration — required dashboard settings

If you connect **GitHub** and the build fails with *“Could not detect a directory containing static files”*, **`wrangler deploy` ran without OpenNext.** You must build first.

**Recommended (simplest):**

| Setting | Value |
|--------|--------|
| **Root directory** | **`web`** |
| **Build command** | **`npm ci && npm run build:cloudflare`** |
| **Deploy command** | **`npx wrangler deploy`** |
| **Environment variables** | Same as the Vercel table (Production) — do **not** leave empty |

**If Root directory must stay `/` (repo root):**

| Setting | Value |
|--------|--------|
| **Root directory** | **`/`** |
| **Build command** | **`npm ci --prefix web && npm run build:cloudflare --prefix web`** |
| **Deploy command** | **`npx wrangler deploy`** |

Deploy reads the root **`wrangler.jsonc`**, which points at **`web/.open-next/`** produced by the build.

Do **not** leave **Build command** empty — that skips `opennextjs-cloudflare build`, so `.open-next/assets` never exists.

The **`name`** in `web/wrangler.jsonc` must match your **Workers project name** in Cloudflare (this repo uses **`fplllm`**). The **`services[].service`** self-reference must use that same name, or deploy fails with “Worker … was not found”.

#### CLI deploy (no Git)

1. One-time: `cd web && npx wrangler login` (Cloudflare account).
2. Set the same server env vars (**Workers & Pages → your worker → Settings → Variables**), or `cd web && npx wrangler secret put SUPABASE_URL`, etc.
3. Deploy:

```bash
cd web
npm ci
npm run deploy:cloudflare
```

You get a **`*.workers.dev`** URL unless you add a custom domain. Local preview (same runtime as prod): `npm run preview:cloudflare`.

#### Gemini on Workers: “User location is not supported”

Google may block **direct** Gemini calls from some **Worker egress** regions. Route traffic through **[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/providers/google-ai-studio/)**.

**Recommended (minimal env):** this repo’s **`web/wrangler.jsonc`** and root **`wrangler.jsonc`** declare an **[`ai` binding](https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/)** named **`AI`**. The app calls `env.AI.gateway(<name>).getUrl("google-ai-studio")` at runtime, so you **do not** need to paste your account ID into an env var.

1. Dashboard → **AI** → **AI Gateway** → create a gateway. Copy its **name** (e.g. `fpl-gemini`).
2. **Workers & Pages** → your Worker → **Settings** → **Variables**:
   - **`CLOUDFLARE_AI_GATEWAY_NAME`** = that gateway name (required for the binding path). Aliases: `CF_AI_GATEWAY_NAME`.
   - **`GEMINI_API_KEY`** = your Google AI Studio key (unchanged).
   - **`GEMINI_AI_GATEWAY_TOKEN`** only if the gateway is **authenticated** (`cf-aig-authorization`). Aliases: `CF_AIG_AUTHORIZATION`.
3. **`nodejs_compat_populate_process_env`** is already in `wrangler.jsonc` so secrets/vars populate `process.env` at runtime.
4. **Redeploy** the Worker after changing `wrangler.jsonc` (so the `AI` binding is live) and after setting variables.

**Preview URLs (`*-fplllm.*.workers.dev`):** Cloudflare often applies **Production** variables only to production. For **branch / preview** deployments, open **Workers & Pages → your project → Settings → Variables** and add **`CLOUDFLARE_AI_GATEWAY_NAME`** (and `GEMINI_API_KEY`, etc.) for **Preview** as well, **or** set **`GEMINI_AI_GATEWAY_BASE_URL`** once (same value for all environments).

**Alternatives** (if you prefer not to use the binding):

- Set **`GEMINI_AI_GATEWAY_BASE_URL`** to the full base URL (no trailing slash), or  
- Set **`CLOUDFLARE_ACCOUNT_ID`** + **`CLOUDFLARE_AI_GATEWAY_NAME`** — the app builds the URL.

**Note:** Long API routes may hit Workers CPU limits; OpenNext also warns that **Windows** local builds can be flaky — use **WSL** or rely on **Linux CI** for stable builds.

### Custom domain (GoDaddy + Cloudflare Workers)

Your app is served by a **Worker** (`*.workers.dev`). To use **`www.faleague-ai.com`** (zone root **`faleague-ai.com`**), DNS must be managed in **the same Cloudflare account** as the Worker; then you attach the hostname to the Worker.

#### 1. Add the zone in Cloudflare

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Add a site** → enter **`faleague-ai.com`** (omit `www`).
2. Pick the Free plan if prompted. Complete the scan/import DNS step.

#### 2. Point GoDaddy nameservers to Cloudflare

1. Cloudflare shows **two nameservers** for `faleague-ai.com` (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
2. **GoDaddy** → **My Products** → **Domains** → **faleague-ai.com** → **DNS** or **Manage DNS** → **Nameservers** → **Change** → **Custom nameservers** → paste **only** Cloudflare’s two values → Save.

Propagation can take minutes to 48 hours. In Cloudflare, the domain should become **Active**.

#### 3. Attach the hostname to your Worker

1. **Workers & Pages** → open **`fplllm`** (your Worker project).
2. **Custom domains** → **Set up a custom domain** → enter **`www.faleague-ai.com`** → continue.

Cloudflare usually creates the right **DNS record** and provisions **TLS** automatically.

Optionally add **`faleague-ai.com`** (apex) as another custom domain, then use **Rules → Redirect Rules** to send **`https://faleague-ai.com/*`** → **`https://www.faleague-ai.com/$1`** so visitors always land on `www`.

#### 4. SSL

Under **SSL/TLS** for the zone, **Full** or **Full (strict)** is normal once the zone is active. Edge certs for your hostnames are issued by Cloudflare.

#### 5. App env (optional)

No code change is required for the domain. Optionally add **`NEXT_PUBLIC_SITE_URL=https://www.faleague-ai.com`** in Worker variables if you later use absolute public URLs.

---

### Custom domain on Vercel (alternative host)

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
| Chat shows “User location is not supported” (FAILED_PRECONDITION) | **Cloudflare Workers:** enable **AI Gateway** and set **`CLOUDFLARE_AI_GATEWAY_NAME`** (this repo includes the **`ai` / `AI` binding** in `wrangler.jsonc` — redeploy after pulling). Or set **`GEMINI_AI_GATEWAY_BASE_URL`**. **Vercel:** `/api/chat` uses **`preferredRegion: iad1`**. |
| Dashboard / planner “couldn’t load” | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; DB has data. |
| Build fails on Vercel | Root Directory must be **`web`** if the repo root is the monorepo. |
| Cloudflare: “Could not detect … static files” / deploy fails | Set a **Build command** that runs OpenNext (`npm ci && npm run build:cloudflare` from **`web`**, or the `--prefix web` variant from repo root). Empty build + only `wrangler deploy` skips `.open-next/assets`. Add env vars. |
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
