export interface TeamRecord {
  id: string;
  tournamentId: string;
  name: string;
  createdAt: Date;
}

export interface TeamRepo {
  create(tournamentId: string, name: string): Promise<TeamRecord>;
  findById(id: string): Promise<TeamRecord | null>;
  findByName(tournamentId: string, name: string): Promise<TeamRecord | null>;
  listByTournament(tournamentId: string): Promise<TeamRecord[]>;
}
