export interface MissionRecord {
  id: string;
  tournamentId: string;
  userId: string;
  description: string;
  prize: string;
  createdAt: Date;
}

export interface NewMission {
  tournamentId: string;
  userId: string;
  description: string;
  prize: string;
}

export interface MissionRepo {
  create(mission: NewMission): Promise<MissionRecord>;
  findById(id: string): Promise<MissionRecord | null>;
  /** All missions in a tournament, newest first (admin view). */
  listByTournament(tournamentId: string): Promise<MissionRecord[]>;
  /** One player's own missions, newest first. */
  listByUser(tournamentId: string, userId: string): Promise<MissionRecord[]>;
  delete(id: string): Promise<void>;
}
