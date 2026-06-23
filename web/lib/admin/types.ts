export type AdminOnboardingView = {
  completed_at: string | null;
  skipped: boolean;
  national_team_code: string | null;
  national_team_name: string | null;
  favorite_leagues: string[];
  fpl_team_id: number | null;
  fpl_team_name: string | null;
  followed_fpl_players: { id: number; name: string }[];
  followed_wc_players: { id: number; name: string }[];
  news_regions: string[];
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  fpl_entry_id: number | null;
  locale: string | null;
  login_days: number;
  last_login_date: string | null;
  theme_team_type: string | null;
  onboarding: AdminOnboardingView;
};
