import { loadScriptEnv } from "./load-env";
loadScriptEnv();

import {
  fetchScoutArticleHtml,
  hasFfsSessionCookie,
  isTruncatedScoutTeaser,
  readFfsSessionCookie,
  stripLen,
} from "../lib/scout/fetch-article";

const URL =
  "https://www.fantasyfootballscout.co.uk/2026/08/20/the-scout-squad-our-top-picks-for-fpl-gameweek-1-2";

async function main() {
  const cookie = readFfsSessionCookie() ?? "";
  if (!hasFfsSessionCookie()) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "FFS_SESSION_COOKIE / FFS_AUTH_COOKIE missing",
      }),
    );
    process.exit(1);
  }

  const fetched = await fetchScoutArticleHtml(URL);
  const html = fetched?.body_html ?? "";
  const report = {
    cookie_length: cookie.length,
    has_wordpress_logged_in: /wordpress_logged_in/i.test(cookie),
    fetched: Boolean(fetched),
    source: fetched?.source ?? null,
    truncated_flag: fetched?.truncated ?? null,
    teaser_detector: html ? isTruncatedScoutTeaser(html) : null,
    body_html_len: html.length,
    strip_len: html ? stripLen(html) : 0,
    looks_full: html.length >= 15000,
    paywall_mention: /requires a Fantasy Football Scout user account/i.test(html),
    snippet_start: html.replace(/\s+/g, " ").slice(0, 180),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!fetched || html.length < 8000 || fetched.truncated) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
