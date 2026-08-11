export type MiniBadgeId =
  | "first_squad"
  | "gw_ready"
  | "template_starter"
  | "league_joiner"
  | "hot_captain"
  | "diff_captain"
  | "mission_complete";

export interface MiniBadgeDef {
  id: MiniBadgeId;
  /** i18n key under mini.badge.* */
  titleKey: string;
  descKey: string;
}

export const MINI_BADGES: MiniBadgeDef[] = [
  {
    id: "first_squad",
    titleKey: "badgeFirstSquadTitle",
    descKey: "badgeFirstSquadDesc",
  },
  {
    id: "gw_ready",
    titleKey: "badgeGwReadyTitle",
    descKey: "badgeGwReadyDesc",
  },
  {
    id: "template_starter",
    titleKey: "badgeTemplateTitle",
    descKey: "badgeTemplateDesc",
  },
  {
    id: "league_joiner",
    titleKey: "badgeLeagueTitle",
    descKey: "badgeLeagueDesc",
  },
  {
    id: "hot_captain",
    titleKey: "badgeHotCaptainTitle",
    descKey: "badgeHotCaptainDesc",
  },
  {
    id: "diff_captain",
    titleKey: "badgeDiffCaptainTitle",
    descKey: "badgeDiffCaptainDesc",
  },
  {
    id: "mission_complete",
    titleKey: "badgeMissionTitle",
    descKey: "badgeMissionDesc",
  },
];

export function mergeBadges(
  existing: string[] | null | undefined,
  unlocked: MiniBadgeId[],
): MiniBadgeId[] {
  const set = new Set<string>(existing ?? []);
  for (const id of unlocked) set.add(id);
  return MINI_BADGES.map((b) => b.id).filter((id) => set.has(id));
}
