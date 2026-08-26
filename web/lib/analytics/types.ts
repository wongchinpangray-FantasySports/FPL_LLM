export const SITE_FEATURES = [
  "home",
  "scout",
  "news",
  "fpl_daily",
  "fpl_briefing",
  "planner",
  "squad_builder",
  "dashboard",
  "manager",
  "players",
  "player",
  "chat",
  "inbox",
  "account",
  "onboarding",
  "auth",
  "mini_game",
  "wc_mini",
  "play",
  "worldcup",
  "mini_league",
  "fixtures",
  "preseason",
  "historical",
  "guide",
  "insights",
  "recommended_squad",
  "price_forecast",
  "price_changes",
  "best_of_position",
  "transfers",
  "set_pieces",
  "defcon",
  "differentials",
  "fixture_swing",
  "preseason_signals",
  "value",
  "xp_accuracy",
  "xg_divergence",
  "xa_divergence",
  "fpl_hub",
  "share",
  "docs",
  "other",
] as const;

export type SiteFeature = (typeof SITE_FEATURES)[number];

export type SiteEventRow = {
  created_at: string;
  path: string;
  feature: string;
  visitor_id: string | null;
  user_id: string | null;
};

export type SiteDailyPoint = {
  date: string;
  pageviews: number;
  visitors: number;
  signed_in: number;
  new_users: number;
};

export type SiteFeatureStat = {
  feature: SiteFeature;
  pageviews: number;
  visitors: number;
  signed_in: number;
};

export type SiteLoginBucket = {
  bucket: "1" | "2_7" | "8_30" | "31_plus";
  users: number;
};

export type SiteProductCounts = {
  squad_builder_drafts: number;
  chat_sessions: number;
  chat_messages: number;
  mini_entries: number;
  mini_profiles: number;
  share_links: number;
  share_views: number;
  scout_pageviews: number;
};

export type SiteActivityStats = {
  from: string;
  to: string;
  days: number;
  table_missing: boolean;
  truncated: boolean;
  pageviews: number;
  unique_visitors: number;
  signed_in_visitors: number;
  anonymous_pageviews: number;
  signed_in_pageviews: number;
  multi_day_visitors: number;
  single_day_visitors: number;
  avg_views_per_visitor: number;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
  total_users: number;
  new_users: number;
  onboarded_users: number;
  fpl_linked_users: number;
  pro_users: number;
  active_today: number;
  active_7d: number;
  active_30d: number;
  daily: SiteDailyPoint[];
  features: SiteFeatureStat[];
  login_buckets: SiteLoginBucket[];
  products: SiteProductCounts;
};
