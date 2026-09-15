export type BountyTargetType = "player" | "team";

export interface BountyRecord {
  id: string;
  tournamentId: string;
  targetType: BountyTargetType;
  /** True for an open bounty (no preset target — first to complete wins). */
  open: boolean;
  /**
   * A user id (targetType = player) or a team id (targetType = team). Null for
   * an open bounty until it is awarded, when it holds the winner.
   */
  targetId: string | null;
  description: string;
  coinValue: number;
  active: boolean;
  awardedAt: Date | null;
  createdAt: Date;
}

export interface NewBounty {
  tournamentId: string;
  targetType: BountyTargetType;
  open: boolean;
  targetId: string | null;
  description: string;
  coinValue: number;
}

export interface BountyRepo {
  create(bounty: NewBounty): Promise<BountyRecord>;
  findById(id: string): Promise<BountyRecord | null>;
  listByTournament(tournamentId: string): Promise<BountyRecord[]>;
  /**
   * Mark a bounty awarded (active = false, awardedAt = now) and return it.
   * Pass `winnerId` to record the winner of an open bounty in `targetId`.
   */
  markAwarded(id: string, winnerId?: string): Promise<BountyRecord>;
  delete(id: string): Promise<void>;
}
