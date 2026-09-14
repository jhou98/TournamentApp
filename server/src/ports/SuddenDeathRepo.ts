export interface SuddenDeathRecord {
  id: string;
  matchupId: string;
  teamAId: string;
  teamBId: string;
  teamARep: string | null;
  teamBRep: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
}

export interface SuddenDeathRepo {
  findByMatchup(matchupId: string): Promise<SuddenDeathRecord | null>;
  /** Create the (empty) sudden-death row for a tied playoff matchup. */
  create(input: { matchupId: string; teamAId: string; teamBId: string }): Promise<SuddenDeathRecord>;
  /** Set one team's representative (side "A" = teamA, "B" = teamB). */
  setRep(matchupId: string, side: "A" | "B", userId: string): Promise<SuddenDeathRecord>;
  /** Record the 1v1 result and the winning team. */
  setResult(
    matchupId: string,
    result: { scoreA: number; scoreB: number; winnerTeamId: string },
  ): Promise<SuddenDeathRecord>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
