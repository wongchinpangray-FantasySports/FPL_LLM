export type WcTeam = {
  id: number;
  code: string;
  name: string;
  short_name: string;
  group_letter: string;
  attack_strength: number;
  defence_strength: number;
};

export type WcFixture = {
  id: number;
  matchday: number;
  home_team_id: number;
  away_team_id: number;
  home_code?: string;
  away_code?: string;
  home_fdr?: number;
  away_fdr?: number;
};

export type WcPlayer = {
  id: number;
  wc_team_id: number;
  name: string;
  fpl_id: number | null;
  position: string;
  team_code: string;
  team_short: string;
  price: number | null;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  form: number;
  minutes: number;
};

export type WcFixtureXp = {
  fixture_id: number;
  matchday: number;
  opp_code: string;
  home: boolean;
  fdr: number;
  xp: number;
};

export type WcPlayerProjection = {
  player: WcPlayer;
  fixtures: WcFixtureXp[];
  xp_total: number;
  xp_by_matchday: Map<number, number>;
};

export type WcRadarAxes = {
  xg: number;
  xa: number;
  form: number;
  goals: number;
  assists: number;
};
