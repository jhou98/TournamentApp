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
  status: GameStatus;
}

export interface GameRepo {
  createMany(games: NewGame[]): Promise<void>;
  findById(id: string): Promise<GameRecord | null>;
  setCourt(id: string, courtId: string): Promise<GameRecord>;
  /** Count games in a given status across the tournament (guards reset/regenerate). */
  countByStatus(tournamentId: string, status: GameStatus): Promise<number>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
