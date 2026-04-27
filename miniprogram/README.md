# FALEAGUE AI — WeChat 小程序

This folder is a **native shell** for the same product as `../web/`:

- **Home** (native): save your FPL **Entry ID** (same storage key as the web app: `fpl_entry_id`).
- **Chat / Dashboard / Planner**: open your deployed **Next.js site** inside a **`<web-view>`** so you do not have to re-implement streaming chat and tool-calling in the mini program.

## 1. Open in WeChat DevTools

1. Install [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html).
2. **Import project** → select this folder: `miniprogram` (the directory that contains `app.json`).
3. If required, register a mini program on [微信公众平台](https://mp.weixin.qq.com/) and paste your **AppID** into `project.config.json` (`"appid": "wx…"`), or use a **test account** per the tool’s wizard.

## 2. Point to your deployment

Edit `config.js`:

```js
module.exports = {
  baseUrl: "https://your-project.vercel.app",
};
```

Use the **same https origin** as your live FALEAGUE AI site (no trailing slash required; code strips it).

## 3. “不支持打开 https://…vercel.app/…” (web-view blocked)

WeChat **does not** allow `web-view` to load random URLs. The host (e.g. `fpl-llm.vercel.app`) must be on your mini program’s **业务域名 (business domain)** list **and** pass **domain verification** (place a `MP_verify_xxxxxx.txt` file on the site root). This is a WeChat rule, not a Vercel bug.

### A. Unblock the simulator (development)

Do **one** of the following:

1. **WeChat DevTools** → top right **Details (详情)** → **Local settings (本地设置)** → turn on **“不校验合法域名、web-view、TLS 版本等”** (do not verify legal domain, web-view, etc.).
2. This repo sets `"urlCheck": false` in `project.config.json` so the **tool** is less strict while you develop. Turn `urlCheck` back to `true` when you are ready to match production rules.

### B. Production: whitelist + verify your Vercel URL

1. In [WeChat MP admin](https://mp.weixin.qq.com/) → **开发** → **开发管理** → **开发设置** → **业务域名 (business domain)** → **add** the exact host, e.g. `fpl-llm.vercel.app` (no `https://`, no path). Use the **same** host as in `miniprogram/config.js` → `baseUrl`.
2. WeChat will give you a file named like **`MP_verify_xxxxxxxxxx.txt`**. Download it.
3. Put that file in your Next.js app: **`web/public/MP_verify_xxxxxxxxxx.txt`** (same file name, same content). Next.js will serve it at `https://your-host.vercel.app/MP_verify_xxxxxxxxxx.txt`.
4. Deploy the web app, confirm the file opens in a browser, then go back to WeChat and **finish** domain verification.
5. Optional: add the same host under **request 合法域名** if you use `wx.request` to the same site.

- Only **https** is allowed. Subdomains are **separate** (e.g. `www` vs bare domain each need their own line + file if you use both).
- For mainland China, **ICP** and extra rules may be required for published mini programs.

## 4. Limitations

- **Mainland China network:** `vercel.app` and Google (Gemini) may be unreachable; same as the web app. A custom domain + compliant hosting may be needed for some users.
- **web-view** is a full embedded browser page: it is the **web** app, not a pixel-native rewrite.
- To add **fully native** screens later, use Taro/uni-app or WXML by hand and call your Next **API** routes with `wx.request` (and handle non-SSE or add a JSON chat endpoint).

## 5. Structure

| Path | Role |
|------|------|
| `app.js` / `app.json` | App entry, theme |
| `config.js` | `baseUrl` for your Vercel deployment |
| `pages/index` | Native home + Entry ID |
| `pages/webview` | Full-screen `web-view` to `baseUrl` |
| `utils/buildUrl.js` | Builds `/chat?entry=…`, `/dashboard/…`, `/planner/…` |

Commit `config.js` with a placeholder `baseUrl` and change per environment, or keep a private override gitignored if you prefer.
