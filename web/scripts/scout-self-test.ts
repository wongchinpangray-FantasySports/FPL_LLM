import assert from "node:assert/strict";
import {
  extractHtmlByClass,
  hashContent,
  sanitizeScoutHtml,
  seriesFromCategories,
  slugFromSourceUrl,
  rewriteHtmlImagesToProxy,
} from "../lib/scout/html";
import { parseScoutRss } from "../lib/scout/rss";
import { eventTypeForGoTarget, resolveGoDestination } from "../lib/scout/links";
import { buildChrisScorecard } from "../lib/scout/scorecard";
import { isScoutStatus } from "../lib/scout/types";
import type { ScoutTrialStats } from "../lib/scout/types";
import {
  articleSlugFromUrl,
  buildFfsFetchHeaders,
  hasFfsSessionCookie,
  isShorterTeaserVsExisting,
  isTruncatedScoutTeaser,
  normalizeFfsCookieHeader,
  stripScoutPaywallBanner,
  wpPostsBySlugUrl,
} from "../lib/scout/fetch-article";
import {
  displayScoutTitle,
  hasRealScoutZh,
  isPlaceholderZh,
  scoutTranslateBadge,
} from "../lib/scout/zh-status";

function testExtractSectionEntryContent() {
  const html = `
    <html><body>
      <section class="entry-content">
        <p>Leeds team guide body</p>
        <div class="wp-block-image"><img src="https://cdn.fantasyfootballscout.co.uk/x.jpg"></div>
      </section>
    </body></html>`;
  const inner = extractHtmlByClass(html, "entry-content");
  assert.ok(inner && inner.includes("Leeds team guide body"));
  assert.equal(extractHtmlByClass("<div class='entry-content'><p>Hi</p></div>", "entry-content")?.includes("Hi"), true);
}

function testFfsFetchHelpers() {
  const url =
    "https://www.fantasyfootballscout.co.uk/2026/08/20/the-scout-squad-our-top-picks-for-fpl-gameweek-1-2";
  assert.equal(
    articleSlugFromUrl(url),
    "the-scout-squad-our-top-picks-for-fpl-gameweek-1-2",
  );
  assert.match(
    wpPostsBySlugUrl(url) ?? "",
    /wp-json\/wp\/v2\/posts\?slug=the-scout-squad-our-top-picks-for-fpl-gameweek-1-2/,
  );
  assert.equal(
    normalizeFfsCookieHeader("Cookie: wordpress_logged_in_x=abc"),
    "wordpress_logged_in_x=abc",
  );

  const teaser = `<p>Intro</p><p>The rest of this article below is completely free to read but requires a Fantasy Football Scout user account for access – you can get yours at no cost here</p><figure><img src="https://cdn.fantasyfootballscout.co.uk/x.jpg"></figure>`;
  assert.equal(isTruncatedScoutTeaser(teaser), true);
  assert.equal(stripScoutPaywallBanner(teaser).includes("requires a Fantasy"), false);

  const full =
    teaser +
    "<p>" +
    "Haaland and João Pedro analysis. ".repeat(80) +
    "</p><table><tr><td>Verbruggen</td></tr></table>";
  assert.equal(isTruncatedScoutTeaser(full), false);

  const longEn = "<p>" + "Haaland analysis. ".repeat(200) + "</p>";
  const shortTeaser = "<p>Intro only</p>";
  assert.equal(isShorterTeaserVsExisting(shortTeaser, longEn, true), true);
  assert.equal(isShorterTeaserVsExisting(longEn, shortTeaser, false), false);
  assert.equal(isShorterTeaserVsExisting(longEn, longEn, false), false);

  const prev = process.env.FFS_SESSION_COOKIE;
  const prevAuth = process.env.FFS_AUTH_COOKIE;
  delete process.env.FFS_SESSION_COOKIE;
  delete process.env.FFS_AUTH_COOKIE;
  assert.equal(hasFfsSessionCookie(), false);
  assert.equal(buildFfsFetchHeaders().Cookie, undefined);
  process.env.FFS_SESSION_COOKIE = "wordpress_logged_in_test=abc";
  assert.equal(hasFfsSessionCookie(), true);
  assert.equal(buildFfsFetchHeaders().Cookie, "wordpress_logged_in_test=abc");
  if (prev === undefined) delete process.env.FFS_SESSION_COOKIE;
  else process.env.FFS_SESSION_COOKIE = prev;
  if (prevAuth === undefined) delete process.env.FFS_AUTH_COOKIE;
  else process.env.FFS_AUTH_COOKIE = prevAuth;
}

function testSanitize() {
  const dirty =
    `<p onclick="alert(1)">Hello <script>x()</script><img src="https://cdn.fantasyfootballscout.co.uk/pic.jpg" alt="Leeds"><a href="javascript:alert(1)">x</a></p>`;
  const { html, images } = sanitizeScoutHtml(dirty, {
    baseUrl: "https://www.fantasyfootballscout.co.uk/post",
  });
  assert.equal(html.includes("script"), false);
  assert.equal(html.includes("onclick"), false);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(images.length, 1);
  assert.equal(
    images[0]?.src,
    "https://cdn.fantasyfootballscout.co.uk/pic.jpg",
  );
  const proxied = rewriteHtmlImagesToProxy(html);
  assert.match(proxied, /\/api\/news\/image\?url=/);
}

function testSlugAndSeries() {
  assert.equal(
    slugFromSourceUrl(
      "https://www.fantasyfootballscout.co.uk/2026/08/20/fpl-2026-27-leeds-best-players-set-piece-takers-predicted-xi-more",
      "https://www.fantasyfootballscout.co.uk/?p=171819",
    ),
    "fpl-2026-27-leeds-best-players-set-piece-takers-predicted-xi-more",
  );
  assert.equal(
    seriesFromCategories(["FPL", "Team Guides", "Pre-Season"]),
    "team_guide",
  );
  assert.equal(seriesFromCategories(["Scout Reports", "Members"]), "scout_report");
  assert.equal(isScoutStatus("pending"), true);
  assert.equal(isScoutStatus("published"), true);
  assert.equal(isScoutStatus("live"), false);
}

function testRssParse() {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item>
      <title>Hello GW1</title>
      <link>https://www.fantasyfootballscout.co.uk/hello</link>
      <guid>https://www.fantasyfootballscout.co.uk/?p=1</guid>
      <dc:creator>Skonto</dc:creator>
      <pubDate>Thu, 20 Aug 2026 00:00:00 +0000</pubDate>
      <category>Team Guides</category>
      <description><![CDATA[<p>Excerpt</p>]]></description>
    </item>
  </channel></rss>`;
  const items = parseScoutRss(xml);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Hello GW1");
  assert.equal(items[0]?.categories.includes("Team Guides"), true);
}

function testGoAndScorecard() {
  assert.equal(eventTypeForGoTarget("premium"), "click_premium");
  assert.equal(eventTypeForGoTarget("qr"), "click_qr");
  const dest = resolveGoDestination("original", "https://www.fantasyfootballscout.co.uk/a");
  assert.equal(dest, "https://www.fantasyfootballscout.co.uk/a");
  const stats: ScoutTrialStats = {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-09-01T00:00:00.000Z",
    published_count: 3,
    pending_count: 12,
    hidden_count: 1,
    pageviews: 40,
    unique_visitors: 22,
    click_premium: 5,
    click_team_rater: 2,
    click_original: 4,
    click_qr: 1,
    distribution_count: 2,
    pro_users: 7,
    top_articles: [
      {
        article_id: "1",
        slug: "leeds",
        title_zh: "利兹指南",
        title_en: "Leeds",
        status: "published",
        pageviews: 20,
        unique_visitors: 10,
        click_premium: 3,
        click_team_rater: 1,
        click_original: 2,
        click_qr: 0,
      },
    ],
    articles: [],
  };
  const card = buildChrisScorecard(stats);
  assert.match(card, /Scout-attributed posts published: \*\*3\*\*/);
  assert.match(card, /Clicks → FFS Premium: \*\*6\*\*/);
  assert.equal(hashContent(["a"]).length, 40);
}

function testZhStatus() {
  const copied = {
    title_en: "Leeds team guide",
    title_zh: "Leeds team guide",
    body_html_en: "<p>Hello</p>",
    body_html_zh: "<p>Hello</p>",
    translation_error: "429 Too Many Requests",
    translate_requested_at: null,
  };
  assert.equal(isPlaceholderZh(copied), true);
  assert.equal(hasRealScoutZh(copied), false);
  assert.equal(scoutTranslateBadge(copied), "failed");
  assert.equal(displayScoutTitle(copied), "Leeds team guide");

  const empty = {
    title_en: "Leeds team guide",
    title_zh: "",
    body_html_zh: null,
    translate_requested_at: null,
    translation_error: null,
  };
  assert.equal(scoutTranslateBadge(empty), "english_only");

  const queued = { ...empty, translate_requested_at: "2026-08-21T00:00:00Z" };
  assert.equal(scoutTranslateBadge(queued), "requested");

  const real = {
    title_en: "Leeds team guide",
    title_zh: "利兹联球队指南",
    body_html_zh: "<p>哈兰德本轮值得考虑。</p>",
    translate_requested_at: null,
    translation_error: null,
  };
  assert.equal(hasRealScoutZh(real), true);
  assert.equal(scoutTranslateBadge(real), "translated");
  assert.equal(displayScoutTitle(real), "利兹联球队指南");
}

testExtractSectionEntryContent();
testFfsFetchHelpers();
testSanitize();
testSlugAndSeries();
testRssParse();
testGoAndScorecard();
testZhStatus();
console.log("scout-self-test: ok (collect-only ingest, Cursor queue, no auto-publish)");
