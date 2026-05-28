import { WC_GROUP_TEAMS } from "@/lib/wc/seed-data";

const BY_CODE = new Map(WC_GROUP_TEAMS.map((t) => [t.code, t.name]));

export function wcTeamFullName(code: string): string {
  return BY_CODE.get(code) ?? code;
}
