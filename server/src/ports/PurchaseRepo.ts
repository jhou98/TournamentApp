export interface PurchaseRecord {
  id: string;
  tournamentId: string;
  userId: string;
  powerupId: string;
  costPaid: number;
  createdAt: Date;
}

export interface NewPurchase {
  tournamentId: string;
  userId: string;
  powerupId: string;
  costPaid: number;
}

export interface PurchaseRepo {
  create(purchase: NewPurchase): Promise<PurchaseRecord>;
  /** A player's owned powerups in a tournament, newest first. */
  listByUser(tournamentId: string, userId: string): Promise<PurchaseRecord[]>;
  findByUserAndPowerup(userId: string, powerupId: string): Promise<PurchaseRecord | null>;
}
