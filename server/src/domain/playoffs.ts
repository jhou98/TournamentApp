/**
 * Playoff bracket seeding (US11) — pure.
 *
 * Seeds a single-elimination bracket from final round-robin standings. The
 * matchup stage enum only models `semifinal | third_place | final`, so the
 * bracket supports **2 or 4 qualifiers**: 4 → two semifinals (#1v#4, #2v#3)
 * feeding a final AND a third-place game between the two semifinal losers;
 * 2 → a final only (no semifinals, so no losers to play a third-place game).
 * (Larger power-of-two brackets would need a `quarterfinal` stage.)
 *
 * Only the immediately-seedable matches (concrete teams known now) come back
 * from this function — the final and third-place game are fed by semifinal
 * results that don't exist yet, so `playoffsService.sync()` creates those two
 * once both semifinals are decided, mirroring this same slot layout.
 */

export type PlayoffStage = "semifinal" | "third_place" | "final";

export interface BracketMatch {
  /** Stable slot id: "SF1", "SF2", "F". */
  slot: string;
  stage: PlayoffStage;
  /** Concrete team for a first-round match; null when fed by a source match. */
  teamAId: string | null;
  teamBId: string | null;
  /** Slot whose winner fills teamA / teamB (final only). */
  sourceA: string | null;
  sourceB: string | null;
}

export const SUPPORTED_QUALIFIERS = [2, 4] as const;

/**
 * Build the bracket from seeds in **rank order** (index 0 = #1 seed).
 * Requires at least `qualifiers` teams.
 */
export function seedBracket(rankedTeamIds: string[], qualifiers: number): BracketMatch[] {
  if (!SUPPORTED_QUALIFIERS.includes(qualifiers as 2 | 4)) {
    throw new Error("Playoff bracket supports 2 or 4 qualifiers");
  }
  if (rankedTeamIds.length < qualifiers) {
    throw new Error(`Need at least ${qualifiers} ranked teams to seed the bracket`);
  }
  const seed = (n: number) => rankedTeamIds[n - 1]!; // 1-based seed number

  if (qualifiers === 2) {
    return [
      { slot: "F", stage: "final", teamAId: seed(1), teamBId: seed(2), sourceA: null, sourceB: null },
    ];
  }
  // qualifiers === 4
  return [
    { slot: "SF1", stage: "semifinal", teamAId: seed(1), teamBId: seed(4), sourceA: null, sourceB: null },
    { slot: "SF2", stage: "semifinal", teamAId: seed(2), teamBId: seed(3), sourceA: null, sourceB: null },
    { slot: "F", stage: "final", teamAId: null, teamBId: null, sourceA: "SF1", sourceB: "SF2" },
  ];
}
