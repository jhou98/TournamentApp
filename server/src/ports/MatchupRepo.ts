export type MatchupStage = "round_robin" | "semifinal" | "final";
export type MatchupStatus = "scheduled" | "in_progress" | "final";

export interface NewMatchup {
  stage: MatchupStage;
  roundIndex: number | null;
  teamAId: string;
  teamBId: string;
}

export interface MatchupRecord {
  id: string;
  tournamentId: string;
  stage: MatchupStage;
  roundIndex: number | null;
  teamAId: string;
  teamBId: string;
  status: MatchupStatus;
  winnerTeamId: string | null;
}

export interface MatchupGameView {
  id: string;
  roundNo: number;
  courtId: string | null;
  status: string;
}

export interface MatchupView extends MatchupRecord {
  teamAName: string;
  teamBName: string;
  games: MatchupGameView[];
}

export interface MatchupRepo {
  /** Create matchups, returning records in the same order as the input. */
  createMany(tournamentId: string, matchups: NewMatchup[]): Promise<MatchupRecord[]>;
  listByTournament(tournamentId: string): Promise<MatchupView[]>;
  findById(id: string): Promise<MatchupRecord | null>;
  updateTeams(id: string, teamAId: string, teamBId: string): Promise<MatchupRecord>;
  /** Set the derived matchup outcome after scores change (US9). */
  setResult(
    id: string,
    result: { status: MatchupStatus; winnerTeamId: string | null },
  ): Promise<MatchupRecord>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
