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
  findById(id: string): Promise<PurchaseRecord | null>;
  /** A player's owned powerups in a tournament, newest first. */
  listByUser(tournamentId: string, userId: string): Promise<PurchaseRecord[]>;
  findByUserAndPowerup(userId: string, powerupId: string): Promise<PurchaseRecord | null>;
  /** Consume a purchase on use — deletes it so the slot is free to rebuy. */
  delete(id: string): Promise<void>;
}
