import type { ValidationIssue } from "@/lib/planner/validate";

export function formatSquadBuilderIssue(
  issue: ValidationIssue,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const v = issue.values;
  switch (issue.code) {
    case "size":
      return t("valSize", { have: Number(v?.have ?? 0) });
    case "club_cap":
      return t("valClubCap", {
        teamId: Number(v?.teamId ?? 0),
        n: Number(v?.n ?? 0),
      });
    case "budget":
      return t("valBudget", {
        spent: String(v?.spent ?? ""),
        budget: String(v?.budget ?? ""),
      });
    case "pos_mismatch":
      return t("valPosMismatch", {
        pos: String(v?.pos ?? ""),
        need: String(v?.need ?? ""),
      });
    default:
      if (issue.code.startsWith("pos_")) {
        return t("valPos", {
          pos: String(v?.pos ?? issue.code.slice(4)),
          need: Number(v?.need ?? 0),
          have: Number(v?.have ?? 0),
        });
      }
      return issue.message;
  }
}
