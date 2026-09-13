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
  status: GameStatus;
}

export interface PairAssignmentInput {
  gameId: string;
  homePairId: string;
  awayPairId: string;
}

export interface GameRepo {
  createMany(games: NewGame[]): Promise<void>;
  findById(id: string): Promise<GameRecord | null>;
  listByMatchup(matchupId: string): Promise<GameRecord[]>;
  setCourt(id: string, courtId: string): Promise<GameRecord>;
  /** Fill home/away pairs on games and move them to `assigned` (US8). */
  assignPairs(assignments: PairAssignmentInput[]): Promise<void>;
  /** Clear pair assignments for a round, reverting non-final games to `awaiting_lineups`. */
  clearAssignmentsForRound(matchupId: string, roundNo: number): Promise<void>;
  /** Count games in a given status across the tournament (guards reset/regenerate). */
  countByStatus(tournamentId: string, status: GameStatus): Promise<number>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
