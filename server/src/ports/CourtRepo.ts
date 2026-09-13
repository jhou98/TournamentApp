export interface CourtRecord {
  id: string;
  tournamentId: string;
  label: string;
}

export interface CourtRepo {
  listByTournament(tournamentId: string): Promise<CourtRecord[]>;
  findById(id: string): Promise<CourtRecord | null>;
  createMany(tournamentId: string, labels: string[]): Promise<CourtRecord[]>;
  rename(id: string, label: string): Promise<CourtRecord>;
  deleteByTournament(tournamentId: string): Promise<void>;
}
