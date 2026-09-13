/**
 * Lineup validation (US7) — pure, framework-free.
 *
 * A lineup is one team's set of doubles pairs for one round of a matchup. The
 * rules: exactly `pairsPerLineup` pairs, each of exactly `pairSize` players,
 * every player on the team roster, no player in two pairs the same round, no
 * duplicate pairing (same player set) within the same matchup.
 */

/** Order-independent key for a pair, so the same two players always collide. */
export function pairKey(playerIds: string[]): string {
  return [...playerIds].sort().join("+");
}

export interface LineupCandidate {
  /** One inner array of player ids per pair. */
  pairs: string[][];
}

export interface LineupRules {
  pairsPerLineup: number;
  pairSize: number;
  /** Eligible players for the team (its roster). */
  rosterIds: string[];
  /** Pair keys already used by this team in OTHER rounds of the same matchup. */
  usedPairKeys?: string[];
}

/**
 * Validate a proposed lineup. Returns a list of human-readable problems;
 * an empty array means the lineup is valid.
 */
export function validateLineup(candidate: LineupCandidate, rules: LineupRules): string[] {
  const errors: string[] = [];
  const { pairs } = candidate;
  const { pairsPerLineup, pairSize } = rules;
  const roster = new Set(rules.rosterIds);
  const usedElsewhere = new Set(rules.usedPairKeys ?? []);

  if (pairs.length !== pairsPerLineup) {
    errors.push(`Lineup must have exactly ${pairsPerLineup} pairs (got ${pairs.length})`);
  }

  const playersUsedThisRound = new Set<string>();
  const pairKeysThisRound = new Set<string>();

  pairs.forEach((pair, index) => {
    const label = `pair ${index + 1}`;

    if (pair.length !== pairSize) {
      errors.push(`${cap(label)} must have exactly ${pairSize} players (got ${pair.length})`);
    }

    const withinPair = new Set<string>();
    for (const playerId of pair) {
      if (!roster.has(playerId)) {
        errors.push(`Player ${playerId} is not on this team`);
      }
      if (withinPair.has(playerId)) {
        errors.push(`Player ${playerId} appears twice in ${label}`);
      } else if (playersUsedThisRound.has(playerId)) {
        errors.push(`Player ${playerId} is used in more than one pair this round`);
      }
      withinPair.add(playerId);
      playersUsedThisRound.add(playerId);
    }

    // Only meaningful once the pair is the right size and internally distinct.
    if (pair.length === pairSize && withinPair.size === pairSize) {
      const key = pairKey(pair);
      if (pairKeysThisRound.has(key)) {
        errors.push(`The same pair is listed twice in this lineup`);
      }
      pairKeysThisRound.add(key);
      if (usedElsewhere.has(key)) {
        errors.push(`That pairing was already used earlier in this matchup`);
      }
    }
  });

  return errors;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
