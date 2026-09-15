export type CoinReason =
  | "match_result"
  | "streak_bonus"
  | "mission"
  | "bounty"
  | "event"
  | "purchase"
  | "admin_adjust";

export interface CoinTransactionRecord {
  id: string;
  tournamentId: string;
  userId: string;
  delta: number;
  reason: CoinReason;
  gameId: string | null;
  bountyId: string | null;
  missionId: string | null;
  purchaseId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface NewCoinTransaction {
  tournamentId: string;
  userId: string;
  delta: number;
  reason: CoinReason;
  gameId?: string | null;
  bountyId?: string | null;
  missionId?: string | null;
  purchaseId?: string | null;
  note?: string | null;
}

/** Aggregated balance for one player. */
export interface CoinBalanceRow {
  userId: string;
  balance: number;
}

export interface CoinLedgerRepo {
  createMany(rows: NewCoinTransaction[]): Promise<void>;
  /** Insert a single ledger row (e.g. a manual admin adjustment) and return it. */
  create(row: NewCoinTransaction): Promise<CoinTransactionRecord>;
  /** Delete the tournament's DERIVED rows (match_result + streak_bonus) — used by recompute. */
  deleteDerivedByTournament(tournamentId: string): Promise<void>;
  /** A single player's balance = SUM(delta) in the tournament. */
  sumByUser(tournamentId: string, userId: string): Promise<number>;
  /** A single player's transactions, newest first. */
  listByUser(tournamentId: string, userId: string): Promise<CoinTransactionRecord[]>;
  /** Every player's balance in the tournament (for the leaderboard). */
  sumByTournamentGroupedByUser(tournamentId: string): Promise<CoinBalanceRow[]>;
}
