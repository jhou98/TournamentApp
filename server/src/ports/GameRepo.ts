export type GameStatus = "awaiting_lineups" | "assigned" | "final";

export interface NewGame {
  matchupId: string;
  roundNo: number;
  courtId: string | null;
}

export interface GameRecord {
  id: string;
  matchupId: string;
  roundNo: number;
  courtId: string | null;
  homePairId: string | null;
  awayPairId: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  winnerPairId: string | null;
  status: GameStatus;
  /** The "one powerup per team per game" slot (US21) — null until a team uses one. */
  teamAPowerupUsedBy: string | null;
  teamBPowerupUsedBy: string | null;
}

export interface PairAssignmentInput {
  gameId: string;
  homePairId: string;
  awayPairId: string;
}

export interface ScoreInput {
  scoreHome: number;
  scoreAway: number;
  winnerPairId: string | null;
  finalizedBy: string;
  courtId?: string;
}

export interface GameRepo {
  createMany(games: NewGame[]): Promise<void>;
  findById(id: string): Promise<GameRecord | null>;
  listByMatchup(matchupId: string): Promise<GameRecord[]>;
  listByTournament(tournamentId: string): Promise<GameRecord[]>;
  setCourt(id: string, courtId: string): Promise<GameRecord>;
  /** Enter/edit a final score, set the winning pair, and mark the game `final` (US9). */
  setScore(id: string, score: ScoreInput): Promise<GameRecord>;
  /** Fill home/away pairs on games and move them to `assigned` (US8). */
  assignPairs(assignments: PairAssignmentInput[]): Promise<void>;
  /** Clear pair assignments for a round, reverting non-final games to `awaiting_lineups`. */
  clearAssignmentsForRound(matchupId: string, roundNo: number): Promise<void>;
  /** Count games in a given status across the tournament (guards reset/regenerate). */
  countByStatus(tournamentId: string, status: GameStatus): Promise<number>;
  deleteByTournament(tournamentId: string): Promise<void>;
  /**
   * Atomically claim a team's powerup slot for a game (US21) if it's still
   * free — race-safe (two teammates hitting Use at once can't both win the
   * slot). Returns false if the slot was already claimed.
   */
  claimPowerupSlot(gameId: string, team: "A" | "B", userId: string): Promise<boolean>;
}
