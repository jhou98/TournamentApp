export interface TournamentRef {
  id: string;
  name: string;
}

export type TournamentStatus = "setup" | "round_robin" | "playoffs" | "completed";

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
}

export interface TournamentRepo {
  /** The single active tournament (Part 0 seeds one; D6 = one tournament for now). */
  getCurrent(): Promise<TournamentRef | null>;
  /** Full config + status of the active tournament. */
  getCurrentDetail(): Promise<TournamentDetail | null>;
  setStatus(id: string, status: TournamentStatus): Promise<void>;
  updateConfig(id: string, patch: Partial<TournamentConfig>): Promise<TournamentDetail>;
}
