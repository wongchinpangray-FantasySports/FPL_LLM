/** World Cup 2026 group-stage draw (48 teams, 12 groups). */

export type WcTeamSeed = {
  code: string;
  name: string;
  short: string;
  group: string;
  /** Approx FIFA rank Mar 2026 — drives attack/defence strengths. */
  rank: number;
};

export type WcPlayerSeed = {
  name: string;
  teamCode: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  /** Link to FPL `players_static` for live xG/xA/form when set. */
  fpl_id?: number;
  price?: number;
  goals?: number;
  assists?: number;
  xg?: number;
  xa?: number;
  form?: number;
  minutes?: number;
};

export const WC_GROUP_TEAMS: WcTeamSeed[] = [
  { code: "MEX", name: "Mexico", short: "MEX", group: "A", rank: 14 },
  { code: "KOR", name: "South Korea", short: "KOR", group: "A", rank: 23 },
  { code: "RSA", name: "South Africa", short: "RSA", group: "A", rank: 59 },
  { code: "CZE", name: "Czechia", short: "CZE", group: "A", rank: 31 },
  { code: "CAN", name: "Canada", short: "CAN", group: "B", rank: 27 },
  { code: "SUI", name: "Switzerland", short: "SUI", group: "B", rank: 19 },
  { code: "QAT", name: "Qatar", short: "QAT", group: "B", rank: 35 },
  { code: "BIH", name: "Bosnia and Herzegovina", short: "BIH", group: "B", rank: 42 },
  { code: "BRA", name: "Brazil", short: "BRA", group: "C", rank: 3 },
  { code: "MAR", name: "Morocco", short: "MAR", group: "C", rank: 13 },
  { code: "SCO", name: "Scotland", short: "SCO", group: "C", rank: 36 },
  { code: "HAI", name: "Haiti", short: "HAI", group: "C", rank: 87 },
  { code: "USA", name: "United States", short: "USA", group: "D", rank: 11 },
  { code: "PAR", name: "Paraguay", short: "PAR", group: "D", rank: 52 },
  { code: "AUS", name: "Australia", short: "AUS", group: "D", rank: 24 },
  { code: "TUR", name: "Türkiye", short: "TUR", group: "D", rank: 28 },
  { code: "GER", name: "Germany", short: "GER", group: "E", rank: 8 },
  { code: "ECU", name: "Ecuador", short: "ECU", group: "E", rank: 29 },
  { code: "CIV", name: "Ivory Coast", short: "CIV", group: "E", rank: 32 },
  { code: "CUW", name: "Curaçao", short: "CUW", group: "E", rank: 88 },
  { code: "NED", name: "Netherlands", short: "NED", group: "F", rank: 7 },
  { code: "JPN", name: "Japan", short: "JPN", group: "F", rank: 18 },
  { code: "TUN", name: "Tunisia", short: "TUN", group: "F", rank: 40 },
  { code: "SWE", name: "Sweden", short: "SWE", group: "F", rank: 25 },
  { code: "BEL", name: "Belgium", short: "BEL", group: "G", rank: 12 },
  { code: "IRN", name: "Iran", short: "IRN", group: "G", rank: 21 },
  { code: "EGY", name: "Egypt", short: "EGY", group: "G", rank: 34 },
  { code: "NZL", name: "New Zealand", short: "NZL", group: "G", rank: 93 },
  { code: "ESP", name: "Spain", short: "ESP", group: "H", rank: 1 },
  { code: "URU", name: "Uruguay", short: "URU", group: "H", rank: 9 },
  { code: "KSA", name: "Saudi Arabia", short: "KSA", group: "H", rank: 58 },
  { code: "CPV", name: "Cape Verde", short: "CPV", group: "H", rank: 65 },
  { code: "FRA", name: "France", short: "FRA", group: "I", rank: 2 },
  { code: "SEN", name: "Senegal", short: "SEN", group: "I", rank: 17 },
  { code: "NOR", name: "Norway", short: "NOR", group: "I", rank: 20 },
  { code: "IRQ", name: "Iraq", short: "IRQ", group: "I", rank: 54 },
  { code: "ARG", name: "Argentina", short: "ARG", group: "J", rank: 4 },
  { code: "AUT", name: "Austria", short: "AUT", group: "J", rank: 22 },
  { code: "ALG", name: "Algeria", short: "ALG", group: "J", rank: 30 },
  { code: "JOR", name: "Jordan", short: "JOR", group: "J", rank: 70 },
  { code: "POR", name: "Portugal", short: "POR", group: "K", rank: 6 },
  { code: "COL", name: "Colombia", short: "COL", group: "K", rank: 10 },
  { code: "UZB", name: "Uzbekistan", short: "UZB", group: "K", rank: 62 },
  { code: "COD", name: "DR Congo", short: "COD", group: "K", rank: 45 },
  { code: "ENG", name: "England", short: "ENG", group: "L", rank: 5 },
  { code: "CRO", name: "Croatia", short: "CRO", group: "L", rank: 15 },
  { code: "PAN", name: "Panama", short: "PAN", group: "L", rank: 48 },
  { code: "GHA", name: "Ghana", short: "GHA", group: "L", rank: 38 },
];

/** Fantasy-relevant pool; `fpl_id` enriches from `players_static` on seed. */
export const WC_PLAYER_SEEDS: WcPlayerSeed[] = [
  { name: "Haaland", teamCode: "NOR", position: "FWD", fpl_id: 430, price: 10.5 },
  { name: "Ødegaard", teamCode: "NOR", position: "MID", fpl_id: 17, price: 8.0 },
  { name: "Salah", teamCode: "EGY", position: "MID", fpl_id: 381, price: 14.0 },
  { name: "Kane", teamCode: "ENG", position: "FWD", fpl_id: 108, price: 12.0 },
  { name: "Saka", teamCode: "ENG", position: "MID", fpl_id: 16, price: 10.0 },
  { name: "Bellingham", teamCode: "ENG", position: "MID", fpl_id: 291, price: 10.5 },
  { name: "Palmer", teamCode: "ENG", position: "MID", fpl_id: 235, price: 10.5 },
  { name: "Rice", teamCode: "ENG", position: "MID", fpl_id: 21, price: 6.5 },
  { name: "Pickford", teamCode: "ENG", position: "GKP", fpl_id: 287, price: 5.0 },
  { name: "Mbappé", teamCode: "FRA", position: "FWD", goals: 12, assists: 5, xg: 11.2, xa: 4.1, form: 7.5, minutes: 1800 },
  { name: "Griezmann", teamCode: "FRA", position: "MID", goals: 6, assists: 4, xg: 5.8, xa: 3.2, form: 6.2, minutes: 1600 },
  { name: "Dembele", teamCode: "FRA", position: "MID", goals: 8, assists: 7, xg: 6.1, xa: 5.4, form: 6.8, minutes: 1500 },
  { name: "Messi", teamCode: "ARG", position: "MID", goals: 9, assists: 8, xg: 7.2, xa: 6.1, form: 7.0, minutes: 1400 },
  { name: "L. Martinez", teamCode: "ARG", position: "FWD", goals: 14, assists: 2, xg: 10.5, xa: 1.8, form: 7.2, minutes: 1700 },
  { name: "Alvarez", teamCode: "ARG", position: "FWD", fpl_id: 29, price: 6.5 },
  { name: "Vinicius Jr", teamCode: "BRA", position: "MID", goals: 11, assists: 9, xg: 9.8, xa: 7.2, form: 7.8, minutes: 2000 },
  { name: "Rodrygo", teamCode: "BRA", position: "MID", goals: 8, assists: 6, xg: 7.1, xa: 4.8, form: 6.5, minutes: 1800 },
  { name: "Raphinha", teamCode: "BRA", position: "MID", fpl_id: 318, price: 7.5 },
  { name: "Alisson", teamCode: "BRA", position: "GKP", fpl_id: 220, price: 5.5 },
  { name: "Marquinhos", teamCode: "BRA", position: "DEF", goals: 2, assists: 0, xg: 1.2, xa: 0.4, form: 5.5, minutes: 1900 },
  { name: "Yamal", teamCode: "ESP", position: "MID", goals: 7, assists: 10, xg: 5.9, xa: 8.1, form: 7.6, minutes: 1750 },
  { name: "Pedri", teamCode: "ESP", position: "MID", goals: 4, assists: 6, xg: 3.8, xa: 5.2, form: 6.4, minutes: 1650 },
  { name: "Morata", teamCode: "ESP", position: "FWD", goals: 10, assists: 2, xg: 8.4, xa: 1.5, form: 6.0, minutes: 1500 },
  { name: "Musiala", teamCode: "GER", position: "MID", goals: 9, assists: 5, xg: 7.5, xa: 4.0, form: 7.1, minutes: 1800 },
  { name: "Wirtz", teamCode: "GER", position: "MID", fpl_id: 100, price: 8.5 },
  { name: "Kimmich", teamCode: "GER", position: "DEF", goals: 2, assists: 7, xg: 1.8, xa: 6.2, form: 6.3, minutes: 2100 },
  { name: "Gündogan", teamCode: "GER", position: "MID", fpl_id: 598, price: 6.0 },
  { name: "Depay", teamCode: "NED", position: "FWD", goals: 8, assists: 4, xg: 6.8, xa: 3.5, form: 6.5, minutes: 1600 },
  { name: "Gakpo", teamCode: "NED", position: "MID", fpl_id: 390, price: 7.5 },
  { name: "Van Dijk", teamCode: "NED", position: "DEF", fpl_id: 373, price: 6.0 },
  { name: "Ronaldo", teamCode: "POR", position: "FWD", goals: 15, assists: 3, xg: 12.0, xa: 2.5, form: 7.4, minutes: 1900 },
  { name: "Leão", teamCode: "POR", position: "MID", goals: 7, assists: 6, xg: 6.2, xa: 4.9, form: 6.7, minutes: 1700 },
  { name: "Bruno Fernandes", teamCode: "POR", position: "MID", fpl_id: 449, price: 9.0 },
  { name: "Dias", teamCode: "POR", position: "DEF", fpl_id: 505, price: 5.5 },
  { name: "Lukaku", teamCode: "BEL", position: "FWD", goals: 11, assists: 3, xg: 9.5, xa: 2.2, form: 6.8, minutes: 1750 },
  { name: "De Bruyne", teamCode: "BEL", position: "MID", fpl_id: 386, price: 9.5 },
  { name: "Son", teamCode: "KOR", position: "MID", fpl_id: 186, price: 8.5 },
  { name: "Modrić", teamCode: "CRO", position: "MID", goals: 3, assists: 5, xg: 2.1, xa: 4.8, form: 5.8, minutes: 1400 },
  { name: "Valverde", teamCode: "URU", position: "MID", goals: 5, assists: 4, xg: 4.2, xa: 3.8, form: 6.5, minutes: 2000 },
  { name: "Núñez", teamCode: "URU", position: "FWD", fpl_id: 525, price: 7.5 },
  { name: "James", teamCode: "COL", position: "MID", goals: 6, assists: 8, xg: 4.5, xa: 6.8, form: 6.9, minutes: 1650 },
  { name: "Díaz", teamCode: "COL", position: "MID", fpl_id: 383, price: 8.0 },
  { name: "Saliba", teamCode: "ENG", position: "DEF", fpl_id: 466, price: 6.0 },
  { name: "Hakimi", teamCode: "MAR", position: "DEF", goals: 3, assists: 6, xg: 2.5, xa: 4.2, form: 6.6, minutes: 1900 },
  { name: "Ounahi", teamCode: "MAR", position: "MID", goals: 4, assists: 5, xg: 3.2, xa: 3.8, form: 6.2, minutes: 1600 },
  { name: "Pulisic", teamCode: "USA", position: "MID", goals: 7, assists: 5, xg: 5.8, xa: 4.1, form: 6.8, minutes: 1750 },
  { name: "McKennie", teamCode: "USA", position: "MID", goals: 3, assists: 4, xg: 2.8, xa: 3.5, form: 5.9, minutes: 1800 },
  { name: "Lozano", teamCode: "MEX", position: "MID", goals: 5, assists: 3, xg: 4.0, xa: 2.8, form: 6.0, minutes: 1500 },
  { name: "Mitoma", teamCode: "JPN", position: "MID", fpl_id: 541, price: 6.5 },
  { name: "Kubo", teamCode: "JPN", position: "MID", goals: 6, assists: 4, xg: 4.8, xa: 3.6, form: 6.3, minutes: 1600 },
  { name: "Mané", teamCode: "SEN", position: "MID", goals: 8, assists: 4, xg: 6.5, xa: 3.2, form: 6.5, minutes: 1700 },
  { name: "Kudus", teamCode: "GHA", position: "MID", fpl_id: 582, price: 6.5 },
  { name: "Partey", teamCode: "GHA", position: "MID", fpl_id: 19, price: 5.0 },
  { name: "Martinez", teamCode: "ARG", position: "GKP", goals: 0, assists: 0, xg: 0, xa: 0, form: 5.5, minutes: 1800 },
  { name: "Maignan", teamCode: "FRA", position: "GKP", goals: 0, assists: 0, xg: 0, xa: 0, form: 5.3, minutes: 1900 },
  { name: "Neuer", teamCode: "GER", position: "GKP", goals: 0, assists: 0, xg: 0, xa: 0, form: 4.8, minutes: 1600 },
  { name: "Courtois", teamCode: "BEL", position: "GKP", goals: 0, assists: 0, xg: 0, xa: 0, form: 5.5, minutes: 1900 },
];

/** Round-robin pairings for a group of 4 (matchday 1–3). Each row: two fixtures. */
export function groupStagePairings(
  teamIds: [number, number, number, number],
): [number, number, number, number][] {
  const [a, b, c, d] = teamIds;
  return [
    [a, b, c, d],
    [a, c, b, d],
    [a, d, b, c],
  ];
}

export function rankToStrength(rank: number): { attack: number; defence: number } {
  const r = Math.min(Math.max(rank, 1), 100);
  const attack = Math.round(88 - (r - 1) * 0.55);
  const defence = Math.round(85 - (r - 1) * 0.5);
  return {
    attack: Math.min(92, Math.max(38, attack)),
    defence: Math.min(90, Math.max(35, defence)),
  };
}
