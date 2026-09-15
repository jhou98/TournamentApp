export type BountyTargetType = "player" | "team";

export interface BountyRecord {
  id: string;
  tournamentId: string;
  targetType: BountyTargetType;
  /** A user id (targetType = player) or a team id (targetType = team). */
  targetId: string;
  description: string;
  coinValue: number;
  active: boolean;
  awardedAt: Date | null;
  createdAt: Date;
}

export interface NewBounty {
  tournamentId: string;
  targetType: BountyTargetType;
  targetId: string;
  description: string;
  coinValue: number;
}

export interface BountyRepo {
  create(bounty: NewBounty): Promise<BountyRecord>;
  findById(id: string): Promise<BountyRecord | null>;
  listByTournament(tournamentId: string): Promise<BountyRecord[]>;
  /** Mark a bounty awarded (active = false, awardedAt = now) and return it. */
  markAwarded(id: string): Promise<BountyRecord>;
  delete(id: string): Promise<void>;
}
