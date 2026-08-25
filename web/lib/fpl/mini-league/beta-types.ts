export type MiniLeagueBetaInviteStatus =
  | "pending"
  | "active"
  | "expired"
  | "revoked";

export type MiniLeagueBetaRole =
  | "preview"
  | "open"
  | "admin"
  | "allowlist"
  | "premium"
  | "tester";

export type MiniLeagueAccessReason =
  | "ok"
  | "unauthenticated"
  | "beta_required"
  | "expired"
  | "premium_required"
  | "revoked";

export type MiniLeagueBetaView = {
  allowed: boolean;
  reason: MiniLeagueAccessReason;
  role: MiniLeagueBetaRole | null;
  startEvent: number | null;
  endEvent: number | null;
  currentGw: number;
  remainingGws: number | null;
  durationEvents: number;
  tableMissing: boolean;
};

export type MiniLeagueBetaInviteRow = {
  id: string;
  email: string | null;
  fplEntryId: number | null;
  token: string;
  path: string;
  invitedBy: string | null;
  startEvent: number | null;
  endEvent: number | null;
  durationEvents: number;
  claimedBy: string | null;
  claimedAt: string | null;
  claimedName: string | null;
  status: MiniLeagueBetaInviteStatus;
  effectiveStatus: MiniLeagueBetaInviteStatus;
  remainingGws: number | null;
  notes: string | null;
  createdAt: string;
};

export type MiniLeagueFeedbackRow = {
  id: string;
  userId: string | null;
  email: string | null;
  fplEntryId: number | null;
  gameweek: number | null;
  toolId: string | null;
  rating: number | null;
  body: string;
  createdAt: string;
};
