import assert from "node:assert/strict";
import {
  featureFromPath,
  normalizeTrackedPath,
  shouldSkipTracking,
} from "../lib/analytics/features";
import { aggregateSiteActivity, rangeWindow, utcDay } from "../lib/analytics/stats";
import type { SiteEventRow } from "../lib/analytics/types";

function testPathMapping() {
  assert.equal(normalizeTrackedPath("/zh/planner/123?x=1"), "/planner/123");
  assert.equal(normalizeTrackedPath("https://www.faleague-ai.com/scout/foo"), "/scout/foo");
  assert.equal(featureFromPath("/"), "home");
  assert.equal(featureFromPath("/zh/"), "home");
  assert.equal(featureFromPath("/planner/99"), "planner");
  assert.equal(featureFromPath("/squad-builder"), "squad_builder");
  assert.equal(featureFromPath("/fpl/insights/recommended-squad"), "recommended_squad");
  assert.equal(featureFromPath("/fpl/insights"), "insights");
  assert.equal(featureFromPath("/fpl/insights/price-changes"), "price_changes");
  assert.equal(featureFromPath("/news/fpl-daily"), "fpl_daily");
  assert.equal(featureFromPath("/scout/some-slug"), "scout");
  assert.equal(featureFromPath("/s/abc"), "share");
  assert.equal(featureFromPath("/play/mini"), "mini_game");
  assert.equal(featureFromPath("/admin"), "other");
  assert.equal(shouldSkipTracking("/admin"), true);
  assert.equal(shouldSkipTracking("/zh/admin/x"), true);
  assert.equal(shouldSkipTracking("/planner"), false);
}

function testRangeWindow() {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const w = rangeWindow(7, now);
  assert.equal(utcDay(w.from), "2026-08-20");
  assert.equal(w.days, 7);
  const w30 = rangeWindow(30, now);
  assert.equal(utcDay(w30.from), "2026-07-28");
  assert.equal(rangeWindow(12, now).days, 30);
}

function testAggregate() {
  const events: SiteEventRow[] = [
    {
      created_at: "2026-08-25T10:00:00.000Z",
      path: "/planner",
      feature: "planner",
      visitor_id: "v1",
      user_id: "u1",
    },
    {
      created_at: "2026-08-25T11:00:00.000Z",
      path: "/planner",
      feature: "planner",
      visitor_id: "v1",
      user_id: "u1",
    },
    {
      created_at: "2026-08-26T09:00:00.000Z",
      path: "/scout/a",
      feature: "scout",
      visitor_id: "v2",
      user_id: null,
    },
    {
      created_at: "2026-08-26T10:00:00.000Z",
      path: "/squad-builder",
      feature: "squad_builder",
      visitor_id: "v1",
      user_id: "u1",
    },
  ];
  const stats = aggregateSiteActivity({
    from: "2026-08-20T00:00:00.000Z",
    to: "2026-08-26T12:00:00.000Z",
    days: 7,
    events,
    profiles: [
      {
        created_at: "2026-08-25T08:00:00.000Z",
        last_login_date: "2026-08-26",
        login_days: 4,
        fpl_entry_id: 1,
        onboarding_completed_at: "2026-08-25T08:10:00.000Z",
        insights_plan: "premium",
      },
      {
        created_at: "2026-07-01T00:00:00.000Z",
        last_login_date: "2026-08-01",
        login_days: 1,
        fpl_entry_id: null,
        onboarding_completed_at: null,
        insights_plan: null,
      },
    ],
    products: {
      squad_builder_drafts: 3,
      chat_sessions: 2,
      chat_messages: 8,
      mini_entries: 1,
      mini_profiles: 1,
      share_links: 0,
      share_views: 0,
      scout_pageviews: 5,
    },
    truncated: false,
    tableMissing: false,
  });

  assert.equal(stats.pageviews, 4);
  assert.equal(stats.unique_visitors, 2);
  assert.equal(stats.signed_in_visitors, 1);
  assert.equal(stats.multi_day_visitors, 1);
  assert.equal(stats.single_day_visitors, 1);
  assert.equal(stats.new_users, 1);
  assert.equal(stats.total_users, 2);
  assert.equal(stats.pro_users, 1);
  assert.equal(stats.fpl_linked_users, 1);
  assert.equal(stats.features[0]?.feature, "planner");
  assert.equal(stats.features[0]?.pageviews, 2);
  const day25 = stats.daily.find((d) => d.date === "2026-08-25");
  assert.equal(day25?.pageviews, 2);
  assert.equal(day25?.new_users, 1);
  assert.equal(stats.products.squad_builder_drafts, 3);
  assert.equal(stats.login_buckets.find((b) => b.bucket === "2_7")?.users, 1);
  assert.equal(stats.login_buckets.find((b) => b.bucket === "1")?.users, 1);
}

testPathMapping();
testRangeWindow();
testAggregate();
console.log("site-analytics-self-test: ok");
