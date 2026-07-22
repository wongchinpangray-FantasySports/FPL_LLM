import { fetchFplXTweets } from "../lib/fpl/fpl-x-feed";

async function testSyndication() {
  const u =
    "https://syndication.twitter.com/srv/timeline-profile/screen-name/FantasyPremierLeague";
  const r = await fetch(u, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html",
      Referer: "https://platform.twitter.com/",
    },
  });
  console.log("syndication status", r.status, "len", (await r.clone().text()).length);
}

async function main() {
  await testSyndication();
  const items = await fetchFplXTweets({ limit: 15 });
  console.log(JSON.stringify(items, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
