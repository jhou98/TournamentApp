export interface NewPair {
  slot: number;
  playerIds: string[];
}

export interface PairRecord {
  id: string;
  lineupId: string;
  slot: number;
  playerIds: string[];
}

export interface LineupRecord {
  id: string;
  matchupId: string;
  teamId: string;
  roundNo: number;
  submittedBy: string;
  locked: boolean;
  lockedAt: Date | null;
}

export interface LineupWithPairs extends LineupRecord {
  pairs: PairRecord[];
}

export interface SaveLineupInput {
  matchupId: string;
  teamId: string;
  roundNo: number;
  submittedBy: string;
  pairs: NewPair[];
}

export interface LineupRepo {
  findByRound(matchupId: string, teamId: string, roundNo: number): Promise<LineupWithPairs | null>;
  listByMatchup(matchupId: string): Promise<LineupWithPairs[]>;
  listByTeam(teamId: string): Promise<LineupWithPairs[]>;
  findById(id: string): Promise<LineupWithPairs | null>;
  /** Create or replace a team's lineup for one round, replacing its pairs. */
  save(input: SaveLineupInput): Promise<LineupWithPairs>;
  setLocked(id: string, locked: boolean): Promise<LineupRecord>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
