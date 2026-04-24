# Push the full monorepo to GitHub

This guide assumes the project root is **`FPL_LLM`** (the folder that contains `web/`, `supabase/`, etc.).

## 0. Install Git (if `git` is not in your PATH)

- Download **Git for Windows**: https://git-scm.com/download/win  
- Run the installer, then **close and reopen** PowerShell or Cursor.
- Check: `git --version`

## 1. Create a new empty repository on GitHub

1. Log in to **https://github.com**  
2. **+** → **New repository**  
3. Name it (e.g. `FPL-LLM`)  
4. Choose **Private** (recommended while you have API keys in local files you must not commit) or **Public**  
5. **Do not** add a README, .gitignore, or license *if* you want the first push to be your existing code only (avoids a merge). If you already created a repo with a README, use the “existing repo” commands in step 4.

## 2. Initialize Git locally (once)

Open **PowerShell** or Cursor’s terminal **in `FPL_LLM`** (monorepo root):

```powershell
cd c:\Users\admin\FPL_LLM

git init
git add .
git status
```

Check `git status`: you should **not** see `.env`, `.env.local`, `web/node_modules`, or `web/.next`.  
If secrets appear, fix `.gitignore` before committing.

```powershell
git commit -m "Initial commit: FPL LLM monorepo"
git branch -M main
```

## 3. Connect GitHub and push

Replace **`YOUR_USER`** and **`YOUR_REPO`** with yours:

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

GitHub may ask you to log in:

- **HTTPS**: use a **Personal Access Token** as the password (Settings → Developer settings → Personal access tokens).  
- Or install **GitHub CLI** (`winget install GitHub.cli`) and run `gh auth login`.

### If GitHub showed “push rejected” because the remote has a README

```powershell
git pull origin main --allow-unrelated-histories
# resolve conflicts if any, then:
git push -u origin main
```

## 4. Confirm on GitHub

Refresh the repo page — you should see **`web/`**, **`supabase/`**, etc., at the root of the repo.

---

**Never commit:** real `GEMINI_API_KEY`, Supabase **service role** keys, or `.env.local`. The root `.gitignore` is there to reduce mistakes; always skim `git status` before each commit.

Next step after the repo exists: **`web/DEPLOY.md`** (Vercel `Root Directory = web`).
