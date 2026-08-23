/**
 * Contest agent API — shared types for organizer ↔ FALEAGUE decide endpoint.
 * Algorithm version bumps when response semantics or ranking rules change.
 */
export const CONTEST_ALGORITHM_VERSION = "contest-v1.0.0";

export type ContestChipId = "wildcard" | "freehit" | "bboost" | "3xc";

export type ContestRiskMode = "neutral" | "chase" | "protect";

export type ContestSquadPlayer = {
  fpl_id: number;
  /** Selling price in £m. Defaults to current `base_price` if omitted. */
  sell_price?: number;
  /** Optional display hints (ignored for legality if they conflict with DB). */
  web_name?: string;
  position?: "GKP" | "DEF" | "MID" | "FWD";
  team_id?: number;
};

export type ContestDecideRequest = {
  /** Target gameweek to set XI / captain / chip for. */
  gw: number;
  bank: number;
  freeTransfers: number;
  chipsRemaining?: ContestChipId[];
  squad: ContestSquadPlayer[];
  /** Horizon for transfer xP (1–8). Default 5. */
  horizon?: number;
  riskMode?: ContestRiskMode;
  /** Allow paying a −4 hit for a 2nd transfer. Default false. */
  allowHits?: boolean;
  /**
   * If true, may set `chip` to `3xc` / `bboost` when thresholds fire.
   * Default false — chip advice stays in `chip_notes` only.
   */
  autoPlayChips?: boolean;
  /** Cap outgoing positions for transfer search. */
  outPositions?: Array<"GKP" | "DEF" | "MID" | "FWD">;
  /**
   * Min season minutes for incoming transfer candidates.
   * Default 270. Use 0 in pure preseason if needed.
   */
  minCandidateMinutes?: number;
};

export type ContestTransferMove = {
  out_fpl_id: number;
  out_web_name: string;
  in_fpl_id: number;
  in_web_name: string;
  position: string;
  xp_delta: number;
  spend_m: number;
};

export type ContestPlayerRef = {
  fpl_id: number;
  web_name: string;
  position: string | null;
  team: string | null;
  team_id: number | null;
  price: number | null;
  xp: number;
};

export type ContestDecideResponse = {
  algorithmVersion: string;
  gw: number;
  horizon: number;
  fromGw: number;
  toGw: number;
  bank_after: number;
  free_transfers_after: number;
  hit_cost: number;
  transfers: ContestTransferMove[];
  startingXi: ContestPlayerRef[];
  benchOrder: ContestPlayerRef[];
  captain: ContestPlayerRef | null;
  vice: ContestPlayerRef | null;
  chip: ContestChipId | null;
  chip_notes: {
    triple_captain: string | null;
    bench_boost: string | null;
    wildcard: string | null;
    freehit: string | null;
  };
  xpSummary: {
    xi_gw: number;
    bench_gw: number;
    captain_ev: number;
    transfer_delta_horizon: number;
  };
  rationale: string;
  scoring: string;
};
