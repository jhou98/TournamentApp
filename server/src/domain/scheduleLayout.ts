/**
 * Court assignment for the generated schedule.
 *
 * Pure: given the ordered matchups (each carrying its round-robin `roundIndex`)
 * and the matchup shape, produce one game slot per (matchup, roundNo, pair slot)
 * with a court index. Games that run concurrently — same round-robin round and
 * same matchup round — get distinct courts; a matchup's own rounds are sequential
 * (the same players can't be on two courts at once), so courts free up between
 * them. If concurrent games exceed the court count, assignment wraps.
 *
 * The caller maps `courtIndex` to a real Court id, so this stays free of DB ids.
 */

export interface GameSlot {
  /** Index into the input `matchups` array. */
  matchupIndex: number;
  /** Matchup round, 1..roundsPerMatchup. */
  roundNo: number;
  /** Pair slot within the round, 1..pairsPerLineup. */
  slot: number;
  /** 0-based court index, 0..courtCount-1. */
  courtIndex: number;
}

export interface LayoutInput {
  matchups: { roundIndex: number }[];
  roundsPerMatchup: number;
  pairsPerLineup: number;
  courtCount: number;
}

export function layoutGames(input: LayoutInput): GameSlot[] {
  const { matchups, roundsPerMatchup, pairsPerLineup, courtCount } = input;
  if (courtCount < 1) throw new Error("courtCount must be >= 1");
  if (roundsPerMatchup < 1) throw new Error("roundsPerMatchup must be >= 1");
  if (pairsPerLineup < 1) throw new Error("pairsPerLineup must be >= 1");

  const games: GameSlot[] = [];
  // Court cursor per concurrent group, keyed by `${roundIndex}:${roundNo}`.
  const cursor = new Map<string, number>();

  matchups.forEach((matchup, matchupIndex) => {
    for (let roundNo = 1; roundNo <= roundsPerMatchup; roundNo++) {
      const key = `${matchup.roundIndex}:${roundNo}`;
      for (let slot = 1; slot <= pairsPerLineup; slot++) {
        const next = cursor.get(key) ?? 0;
        games.push({ matchupIndex, roundNo, slot, courtIndex: next % courtCount });
        cursor.set(key, next + 1);
      }
    }
  });

  return games;
}
