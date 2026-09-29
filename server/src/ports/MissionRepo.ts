export interface MissionRecord {
  id: string;
  tournamentId: string;
  userId: string;
  description: string;
  prize: string;
  completed: boolean;
  completedAt: Date | null;
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
  /** All missions in a tournament, newest first (admin view — completed and not). */
  listByTournament(tournamentId: string): Promise<MissionRecord[]>;
  /** One player's own missions, newest first (completed and not). */
  listByUser(tournamentId: string, userId: string): Promise<MissionRecord[]>;
  /** Flag a mission completed (the player did it, shown the commissioner). */
  markCompleted(id: string): Promise<MissionRecord>;
  delete(id: string): Promise<void>;
}
