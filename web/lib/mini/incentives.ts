/** Positive incentives: differential captain bonus + weekly missions. */

export const MINI_DIFF_OWN_PCT = 10;
/** Flat Mini points added when the doubled captain/vice is a differential. */
export const MINI_DIFF_CAPTAIN_BONUS = 2;
/** Prefer Mini ownership once enough squads exist; else fall back to FPL %. */
export const MINI_DIFF_MIN_ENTRIES = 5;

export function isDifferentialPick(opts: {
  miniOwnedPct: number | null | undefined;
  fplOwnedPct?: number | null | undefined;
  miniEntries: number;
}): boolean {
  const mini = opts.miniOwnedPct;
  if (opts.miniEntries >= MINI_DIFF_MIN_ENTRIES && mini != null) {
    return mini <= MINI_DIFF_OWN_PCT;
  }
  if (mini != null && opts.miniEntries > 0) {
    return mini <= MINI_DIFF_OWN_PCT;
  }
  const fpl = opts.fplOwnedPct;
  if (fpl != null) return fpl <= MINI_DIFF_OWN_PCT;
  return false;
}

export type MiniMissionId =
  | "include_diff"
  | "diff_captain"
  | "five_clubs"
  | "under_owned_pair";

export interface MiniMissionDef {
  id: MiniMissionId;
  titleKey: string;
  bodyKey: string;
}

const MISSION_ROTATION: MiniMissionDef[] = [
  {
    id: "include_diff",
    titleKey: "missionIncludeDiffTitle",
    bodyKey: "missionIncludeDiffBody",
  },
  {
    id: "diff_captain",
    titleKey: "missionDiffCaptainTitle",
    bodyKey: "missionDiffCaptainBody",
  },
  {
    id: "five_clubs",
    titleKey: "missionFiveClubsTitle",
    bodyKey: "missionFiveClubsBody",
  },
  {
    id: "under_owned_pair",
    titleKey: "missionUnderOwnedPairTitle",
    bodyKey: "missionUnderOwnedPairBody",
  },
];

export function missionForGw(gw: number): MiniMissionDef {
  const idx = Math.max(0, (Math.floor(gw) - 1) % MISSION_ROTATION.length);
  return MISSION_ROTATION[idx]!;
}

export interface MissionPickInput {
  fpl_id: number;
  team_id: number | null;
  selected_by_percent?: number | null;
}

export function evaluateMission(opts: {
  missionId: MiniMissionId;
  picks: MissionPickInput[];
  captainFplId: number;
  miniOwnedById: Record<number, number>;
  miniEntries: number;
}): boolean {
  const { missionId, picks, captainFplId, miniOwnedById, miniEntries } = opts;
  if (picks.length !== 5) return false;

  const isDiff = (p: MissionPickInput) =>
    isDifferentialPick({
      miniOwnedPct: miniOwnedById[p.fpl_id] ?? null,
      fplOwnedPct: p.selected_by_percent ?? null,
      miniEntries,
    });

  switch (missionId) {
    case "include_diff":
      return picks.some(isDiff);
    case "diff_captain": {
      const cap = picks.find((p) => p.fpl_id === captainFplId);
      return cap != null && isDiff(cap);
    }
    case "five_clubs": {
      const clubs = new Set(
        picks.map((p) => p.team_id).filter((id): id is number => id != null),
      );
      return clubs.size >= 5;
    }
    case "under_owned_pair":
      return picks.filter(isDiff).length >= 2;
    default:
      return false;
  }
}
