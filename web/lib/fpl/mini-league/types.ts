export type MiniLeagueKind = "mini" | "public" | "overall";

export type MiniLeagueFormat = "classic" | "h2h";

export type RankMoveDir = "up" | "down" | "same" | "new";

export type MiniLeagueSummary = {
  id: number;
  name: string;
  kind: MiniLeagueKind;
  format: MiniLeagueFormat;
  scoring: string | null;
  startEvent: number | null;
  closed: boolean;
  rank: number | null;
  lastRank: number | null;
  rankDelta: number | null;
  rankDir: RankMoveDir;
  admin: boolean;
};

export type MiniLeagueStandingRow = {
  entry: number;
  entryName: string;
  playerName: string;
  rank: number;
  lastRank: number | null;
  rankDelta: number | null;
  rankDir: RankMoveDir;
  eventTotal: number;
  total: number;
  pointsFor: number | null;
  squadDiffPct: number | null;
  isYou: boolean;
};

export type MiniLeagueStandingsPage = {
  format: MiniLeagueFormat;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
  rows: MiniLeagueStandingRow[];
};

export type MiniLeaguePlayerRef = {
  fplId: number;
  webName: string;
  team: string | null;
  position: string | null;
  price: number | null;
  fixture: string | null;
  status: string | null;
  chance: number | null;
  news: string | null;
  xp: number | null;
};

export type MiniLeagueOwnedPlayer = MiniLeaguePlayerRef & {
  owners: number;
  ownerPct: number;
  youOwn: boolean;
  captainOwners: number;
};

export type MiniLeagueTransferIdea = MiniLeaguePlayerRef & {
  ownersAbove: number;
  ownerPctAbove: number;
  reason: "rival_cover" | "template_gap";
};

export type MiniLeagueSellIdea = MiniLeaguePlayerRef & {
  ownerPct: number;
  reason: "availability" | "unique_low_xp";
};

export type MiniLeagueHealthFlag = {
  fplId: number;
  webName: string;
  kind: "injured" | "doubtful" | "suspended" | "unavailable" | "news";
  note: string;
};

export type MiniLeagueAnalysis = {
  league: MiniLeagueSummary;
  format: MiniLeagueFormat;
  gw: number | null;
  memberCount: number;
  memberCountExact: boolean;
  sampledManagers: number;
  sampleIncomplete: boolean;
  you: MiniLeagueStandingRow | null;
  leader: MiniLeagueStandingRow | null;
  gapToLeader: number | null;
  gapToNext: number | null;
  pointsToCatchNext: number | null;
  standings: MiniLeagueStandingRow[];
  movers: MiniLeagueStandingRow[];
  template: MiniLeagueOwnedPlayer[];
  differentials: MiniLeagueOwnedPlayer[];
  missingTemplate: MiniLeagueOwnedPlayer[];
  captain: {
    yours: MiniLeaguePlayerRef | null;
    leagueTop: MiniLeagueOwnedPlayer | null;
  };
  transfersIn: MiniLeagueTransferIdea[];
  transfersOut: MiniLeagueSellIdea[];
  health: MiniLeagueHealthFlag[];
};

export type MiniLeagueSquadPick = MiniLeaguePlayerRef & {
  slot: number;
  captain: boolean;
  vice: boolean;
  starter: boolean;
};

export type MiniLeagueManagerSquad = {
  entry: number;
  teamName: string;
  managerName: string;
  points: number | null;
  picks: MiniLeagueSquadPick[];
};

export type MiniLeagueRivalCompare = {
  gw: number;
  you: MiniLeagueManagerSquad;
  rival: MiniLeagueManagerSquad;
  theyHaveYouDont: MiniLeaguePlayerRef[];
  youHaveTheyDont: MiniLeaguePlayerRef[];
  pointsGap: number | null;
};

export type MiniLeagueIndex = {
  entryId: number;
  teamName: string;
  managerName: string;
  currentGw: number | null;
  classic: MiniLeagueSummary[];
  h2h: MiniLeagueSummary[];
};

export type MiniLeagueHistoryGw = {
  event: number;
  points: number;
  total: number;
  overallRank: number | null;
  transfers: number | null;
  hits: number | null;
};

export type MiniLeagueManagerHistory = {
  entry: number;
  teamName: string;
  managerName: string;
  overallRank: number | null;
  overallPoints: number | null;
  current: MiniLeagueHistoryGw[];
  chips: Array<{ name: string; event: number }>;
  past: Array<{ season: string; rank: number; points: number }>;
};

export type MiniLeagueToolId =
  | "rankHistory"
  | "chips"
  | "liveGw"
  | "beatRival"
  | "fixtures"
  | "h2h";

export type MiniLeagueRankChartRole = "you" | "leader" | "next" | "nearby";

export type MiniLeagueChipSlot = {
  used: boolean;
  event: number | null;
};

export type MiniLeagueChipSlots = {
  wc1: MiniLeagueChipSlot;
  wc2: MiniLeagueChipSlot;
  fh1: MiniLeagueChipSlot;
  fh2: MiniLeagueChipSlot;
  bb1: MiniLeagueChipSlot;
  bb2: MiniLeagueChipSlot;
  tc1: MiniLeagueChipSlot;
  tc2: MiniLeagueChipSlot;
};

export type MiniLeagueChipRow = {
  entry: number;
  teamName: string;
  managerName: string;
  isYou: boolean;
  role: MiniLeagueRankChartRole;
  slots: MiniLeagueChipSlots;
};

export type MiniLeagueChartPoint = {
  event: number;
  rank: number | null;
  points: number | null;
  overallRank: number | null;
};

export type MiniLeagueRankSeries = {
  entry: number;
  teamName: string;
  managerName: string;
  isYou: boolean;
  role: MiniLeagueRankChartRole;
  lastRank: number | null;
  rank: number;
  points: MiniLeagueChartPoint[];
};

export type MiniLeagueOverallSeries = {
  entry: number;
  teamName: string;
  managerName: string;
  isYou: boolean;
  role: MiniLeagueRankChartRole;
  points: Array<{ event: number; overallRank: number | null }>;
};

export type MiniLeagueRankChart = {
  gw: number;
  gws: number[];
  miniLeague: MiniLeagueRankSeries[];
  overall: MiniLeagueOverallSeries[];
};

export type MiniLeagueFixtureClubShare = {
  gw: number;
  teamId: number;
  team: string;
  rivalCount: number;
};

export type MiniLeagueFixtureBlank = {
  gw: number;
  fplId: number;
  webName: string;
  team: string;
  position: string;
};

export type MiniLeagueFixtureSameOpp = {
  gw: number;
  opp: string;
  yourCount: number;
};

export type MiniLeagueFixtureRunCell = {
  event: number;
  matches: number;
  fdrAvg: number | null;
  xp: number | null;
};

export type MiniLeagueFixtureRun = {
  entry: number;
  teamName: string;
  isYou: boolean;
  role: MiniLeagueRankChartRole;
  cells: MiniLeagueFixtureRunCell[];
  xpTotal: number | null;
};

export type MiniLeagueFixtureOverlap = {
  fromGw: number;
  toGw: number;
  gws: number[];
  runs: MiniLeagueFixtureRun[];
  sharedDgw: MiniLeagueFixtureClubShare[];
  blanks: MiniLeagueFixtureBlank[];
  sameOpp: MiniLeagueFixtureSameOpp[];
};

export type MiniLeagueToolsPayload = {
  gw: number;
  format: MiniLeagueFormat;
  sample: MiniLeagueStandingRow[];
  rankChart: MiniLeagueRankChart;
  chips: MiniLeagueChipRow[];
  fixtures: MiniLeagueFixtureOverlap;
};

export type MiniLeagueLiveStatus = "not_started" | "live" | "finished";

export type MiniLeagueLiveManager = {
  entry: number;
  teamName: string;
  managerName: string;
  rank: number;
  isYou: boolean;
  lastGwPoints: number;
  livePoints: number | null;
  remaining: number | null;
  playing: number | null;
  captain: MiniLeaguePlayerRef | null;
  chip: string | null;
};

export type MiniLeagueLivePayload = {
  gw: number;
  status: MiniLeagueLiveStatus;
  you: MiniLeagueLiveManager | null;
  above: MiniLeagueLiveManager | null;
  below: MiniLeagueLiveManager | null;
  sample: MiniLeagueLiveManager[];
  avgRemaining: number | null;
};

export type MiniLeagueBeatReason = "rival_cover" | "template" | "xp";

export type MiniLeagueBeatSuggestion = {
  out: MiniLeaguePlayerRef;
  in: MiniLeaguePlayerRef;
  reason: MiniLeagueBeatReason;
  xpDelta: number | null;
};

export type MiniLeagueGwSwing = {
  event: number;
  youPoints: number | null;
  rivalPoints: number | null;
  delta: number | null;
};

export type MiniLeagueBeatRival = MiniLeagueRivalCompare & {
  squadDiffPct: number | null;
  suggestion: MiniLeagueBeatSuggestion | null;
  gws: number[];
  swings: MiniLeagueGwSwing[];
  youWon: number;
  theyWon: number;
  draws: number;
};

export type MiniLeagueH2hLean = "you" | "them" | "even";

export type MiniLeagueH2hSide = {
  entry: number;
  teamName: string;
  managerName: string;
  points: number | null;
  chips: MiniLeagueChipSlots;
  captain: MiniLeaguePlayerRef | null;
};

export type MiniLeagueH2hMatchup = {
  gw: number;
  isBye: boolean;
  you: MiniLeagueH2hSide;
  opponent: MiniLeagueH2hSide | null;
  lean: MiniLeagueH2hLean;
};

export type MiniLeagueH2hPayload = {
  leagueId: number;
  leagueName: string;
  gw: number;
  mode: "h2h" | "race";
  matchup: MiniLeagueH2hMatchup | null;
  form: MiniLeagueGwSwing[];
  youWon: number;
  theyWon: number;
};
