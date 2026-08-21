import type { FplEntry } from "@/lib/fpl";

export type FplEntryPreview = {
  entry_id: number;
  team_name: string;
  manager_name: string;
};

export function toFplEntryPreview(entry: FplEntry): FplEntryPreview {
  const manager = `${entry.player_first_name ?? ""} ${entry.player_last_name ?? ""}`
    .trim()
    .replace(/\s+/g, " ");
  return {
    entry_id: entry.id,
    team_name: (entry.name ?? "").trim() || `Entry #${entry.id}`,
    manager_name: manager || "—",
  };
}
