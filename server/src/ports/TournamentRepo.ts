import type { CoinRule } from "../domain/coinRule.js";

export interface TournamentRef {
  id: string;
  name: string;
}

export type TournamentStatus = "setup" | "round_robin" | "playoffs" | "completed";

/** A tournament shown in a picker: identity + current status. */
export interface TournamentSummary extends TournamentRef {
  status: TournamentStatus;
}

/** The editable numeric shape of the tournament (rules JSON is handled elsewhere). */
export interface TournamentConfig {
  teamCount: number;
  teamSize: number;
  pairSize: number;
  pairsPerLineup: number;
  roundsPerMatchup: number;
  roundRobinCycles: number;
  playoffQualifiers: number;
  courtCount: number;
}

export interface TournamentDetail extends TournamentRef, TournamentConfig {
  status: TournamentStatus;
  coinRule: CoinRule;
}

/** Everything needed to create a tournament row (config + the rules JSON blobs). */
export interface NewTournament extends TournamentConfig {
  name: string;
  coinRule: unknown;
  streakRule: unknown;
  suddenDeathRule: unknown;
}

export interface TournamentRepo {
  /** Full config + status of one tournament (US28 — resolved per request). */
  getDetail(id: string): Promise<TournamentDetail | null>;
  /** All tournaments (admins see every one). */
  list(): Promise<TournamentSummary[]>;
  /** Summaries for a specific set of ids (a non-admin's accessible tournaments). */
  listByIds(ids: string[]): Promise<TournamentSummary[]>;
  create(input: NewTournament): Promise<TournamentDetail>;
  setStatus(id: string, status: TournamentStatus): Promise<void>;
  updateConfig(id: string, patch: Partial<TournamentConfig>): Promise<TournamentDetail>;
}
