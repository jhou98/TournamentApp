export interface PowerupRecord {
  id: string;
  tournamentId: string;
  name: string;
  description: string;
  cost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPowerup {
  tournamentId: string;
  name: string;
  description: string;
  cost: number;
}

export interface PowerupUpdate {
  name?: string;
  description?: string;
  cost?: number;
}

export interface PowerupRepo {
  create(powerup: NewPowerup): Promise<PowerupRecord>;
  findById(id: string): Promise<PowerupRecord | null>;
  listByTournament(tournamentId: string): Promise<PowerupRecord[]>;
  update(id: string, patch: PowerupUpdate): Promise<PowerupRecord>;
  delete(id: string): Promise<void>;
}
