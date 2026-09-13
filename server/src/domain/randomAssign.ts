/**
 * Random pair assignment (US8) — pure, with an injectable RNG so it is
 * deterministic under test. Once both teams lock their lineups for a round,
 * the system matches each home pair against a randomly chosen away pair.
 */

export type Rng = () => number;

/** Fisher–Yates shuffle producing a new array; leaves the input untouched. */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

export interface PairAssignment {
  homePairId: string;
  awayPairId: string;
}

/**
 * Match home pairs against away pairs — home pair i plays a randomly permuted
 * away pair. Both sides must field the same number of pairs.
 */
export function assignPairs(
  homePairIds: string[],
  awayPairIds: string[],
  rng: Rng = Math.random,
): PairAssignment[] {
  if (homePairIds.length !== awayPairIds.length) {
    throw new Error("home and away must field the same number of pairs");
  }
  const shuffledAway = shuffle(awayPairIds, rng);
  return homePairIds.map((homePairId, i) => ({ homePairId, awayPairId: shuffledAway[i]! }));
}
