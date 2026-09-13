/**
 * Lineup validation (US7) — pure, framework-free.
 *
 * A lineup is one team's set of doubles pairs for one round of a matchup. The
 * rules: exactly `pairsPerLineup` pairs, each of exactly `pairSize` players,
 * every player on the team roster, no player in two pairs the same round, no
 * duplicate pairing (same player set) within the same matchup.
 *
 * Validation returns *structured* problems (never a pre-baked string) so the
 * caller can render them with player display names — ids never leak to the UI.
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

export type LineupProblem =
  | { kind: "pair_count"; expected: number; actual: number }
  | { kind: "pair_size"; pairIndex: number; expected: number; actual: number }
  | { kind: "not_on_roster"; playerId: string; pairIndex: number }
  | { kind: "duplicate_in_pair"; playerId: string; pairIndex: number }
  | { kind: "player_reused"; playerId: string }
  | { kind: "duplicate_pair_in_lineup"; pairIndex: number }
  | { kind: "pairing_reused"; pairIndex: number };

/**
 * Validate a proposed lineup. Returns a list of structured problems;
 * an empty array means the lineup is valid.
 */
export function validateLineup(candidate: LineupCandidate, rules: LineupRules): LineupProblem[] {
  const problems: LineupProblem[] = [];
  const { pairs } = candidate;
  const { pairsPerLineup, pairSize } = rules;
  const roster = new Set(rules.rosterIds);
  const usedElsewhere = new Set(rules.usedPairKeys ?? []);

  if (pairs.length !== pairsPerLineup) {
    problems.push({ kind: "pair_count", expected: pairsPerLineup, actual: pairs.length });
  }

  const playersUsedThisRound = new Set<string>();
  const pairKeysThisRound = new Set<string>();

  pairs.forEach((pair, index) => {
    if (pair.length !== pairSize) {
      problems.push({ kind: "pair_size", pairIndex: index, expected: pairSize, actual: pair.length });
    }

    const withinPair = new Set<string>();
    for (const playerId of pair) {
      if (!roster.has(playerId)) {
        problems.push({ kind: "not_on_roster", playerId, pairIndex: index });
      }
      if (withinPair.has(playerId)) {
        problems.push({ kind: "duplicate_in_pair", playerId, pairIndex: index });
      } else if (playersUsedThisRound.has(playerId)) {
        problems.push({ kind: "player_reused", playerId });
      }
      withinPair.add(playerId);
      playersUsedThisRound.add(playerId);
    }

    // Only meaningful once the pair is the right size and internally distinct.
    if (pair.length === pairSize && withinPair.size === pairSize) {
      const key = pairKey(pair);
      if (pairKeysThisRound.has(key)) {
        problems.push({ kind: "duplicate_pair_in_lineup", pairIndex: index });
      }
      pairKeysThisRound.add(key);
      if (usedElsewhere.has(key)) {
        problems.push({ kind: "pairing_reused", pairIndex: index });
      }
    }
  });

  return problems;
}

/**
 * Render a problem as a human-readable sentence, resolving player ids to names
 * via `nameOf`. Never emits a raw id.
 */
export function describeLineupProblem(
  problem: LineupProblem,
  nameOf: (playerId: string) => string,
): string {
  switch (problem.kind) {
    case "pair_count":
      return `Lineup must have exactly ${problem.expected} pairs (got ${problem.actual})`;
    case "pair_size":
      return `Pair ${problem.pairIndex + 1} must have exactly ${problem.expected} players (got ${problem.actual})`;
    case "not_on_roster":
      return `${nameOf(problem.playerId)} is not on this team`;
    case "duplicate_in_pair":
      return `${nameOf(problem.playerId)} appears twice in pair ${problem.pairIndex + 1}`;
    case "player_reused":
      return `${nameOf(problem.playerId)} is used in more than one pair this match`;
    case "duplicate_pair_in_lineup":
      return `Pair ${problem.pairIndex + 1} repeats an identical pairing in this lineup`;
    case "pairing_reused":
      return `Pair ${problem.pairIndex + 1} was already used earlier in this matchup`;
  }
}
