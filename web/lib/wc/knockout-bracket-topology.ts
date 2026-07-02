/**
 * FIFA World Cup 2026 fixed knockout tree (match numbers from the official bracket).
 * play.fifa.com rounds.json lists matches in schedule order — not tree order.
 * @see https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/knockout-stage-match-schedule-bracket
 */

/** Round of 32 pairs for the left half (top → bottom). */
export const WC2026_LEFT_R32_PAIRS: readonly (readonly [number, number])[] = [
  [73, 75],
  [74, 77],
  [76, 78],
  [79, 80],
];

/** Round of 32 pairs for the right half (top → bottom). */
export const WC2026_RIGHT_R32_PAIRS: readonly (readonly [number, number])[] = [
  [81, 82],
  [83, 84],
  [85, 87],
  [86, 88],
];

export const WC2026_LEFT_R16 = [90, 89, 91, 92] as const;
export const WC2026_RIGHT_R16 = [94, 93, 96, 95] as const;

export const WC2026_LEFT_QF = [97, 99] as const;
export const WC2026_RIGHT_QF = [98, 100] as const;

export const WC2026_LEFT_SF = 101;
export const WC2026_RIGHT_SF = 102;
export const WC2026_FINAL = 104;

/** Display order per round: left half then right half, aligned for the bracket UI. */
export const WC2026_ROUND_ORDER: Record<number, readonly number[]> = {
  4: [
    ...WC2026_LEFT_R32_PAIRS.flat(),
    ...WC2026_RIGHT_R32_PAIRS.flat(),
  ],
  5: [...WC2026_LEFT_R16, ...WC2026_RIGHT_R16],
  6: [...WC2026_LEFT_QF, ...WC2026_RIGHT_QF],
  7: [WC2026_LEFT_SF, WC2026_RIGHT_SF],
  8: [WC2026_FINAL],
};

/** Winner of each feeder match advances into this knockout match. */
export const WC2026_FEEDERS: Record<number, readonly [number, number]> = {
  89: [74, 77],
  90: [73, 75],
  91: [76, 78],
  92: [79, 80],
  93: [83, 84],
  94: [81, 82],
  95: [86, 88],
  96: [85, 87],
  97: [89, 90],
  98: [93, 94],
  99: [91, 92],
  100: [95, 96],
  101: [97, 98],
  102: [99, 100],
  104: [101, 102],
};
