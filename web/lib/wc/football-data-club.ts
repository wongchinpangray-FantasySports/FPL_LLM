/**
 * Optional football-data.org enrichment (set FOOTBALL_DATA_API_KEY).
 * v4 has no public name search; we keep this stub for a future person-id index.
 */
export type FootballDataClubResult = {
  club: string;
  league: string | null;
  person_id: number;
};

export async function fetchFootballDataClub(
  _playerName: string,
): Promise<FootballDataClubResult | null> {
  if (!process.env.FOOTBALL_DATA_API_KEY?.trim()) return null;
  return null;
}
