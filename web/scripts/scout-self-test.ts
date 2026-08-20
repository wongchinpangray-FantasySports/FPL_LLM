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

testExtractSectionEntryContent();
testSanitize();
testSlugAndSeries();
testRssParse();
testGoAndScorecard();
console.log("scout-self-test: ok (pending-by-default, no auto-publish)");
