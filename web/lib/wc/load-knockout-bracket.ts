import { fetchFifaRounds } from "@/lib/wc/fifa-rounds";
import { buildWcMatchesWithStats } from "@/lib/wc/match-stats-store";
import {
  buildKnockoutBracket,
  type KnockoutBracket,
} from "@/lib/wc/knockout-bracket";

export async function loadKnockoutBracket(
  locale: string,
): Promise<KnockoutBracket | null> {
  const [{ matches }, fifaRounds] = await Promise.all([
    buildWcMatchesWithStats(),
    fetchFifaRounds(),
  ]);
  const byId = new Map(matches.map((m) => [m.id, m]));
  return buildKnockoutBracket(fifaRounds, byId, locale);
}
