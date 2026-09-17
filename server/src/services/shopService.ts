/**
 * Player-facing shop (US20, scoped down for now): browse the powerup catalog,
 * buy one with coins, and see what's already owned. A player can own at most
 * one of each powerup — an owned powerup isn't buyable again. No activation
 * timing or "used" state yet (US21+).
 */

import { NotFoundError, ValidationError } from "../domain/errors.js";
import type { CoinLedgerRepo, PowerupRepo, PurchaseRecord, PurchaseRepo, UnitOfWork } from "../ports/index.js";

export interface ShopServiceDeps {
  powerups: PowerupRepo;
  purchases: PurchaseRepo;
  coinLedger: CoinLedgerRepo;
  uow: UnitOfWork;
}

/** A catalog powerup as a player sees it: buyable, or already owned. */
export interface ShopPowerupView {
  id: string;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
}

/** An owned powerup, for the player's inventory. */
export interface InventoryItemView {
  id: string;
  powerupId: string;
  name: string;
  description: string;
  cost: number;
  purchasedAt: string;
}

export interface PurchaseResult {
  purchase: InventoryItemView;
  balance: number;
}

export interface ShopService {
  listForUser(tournamentId: string, userId: string): Promise<ShopPowerupView[]>;
  listInventory(tournamentId: string, userId: string): Promise<InventoryItemView[]>;
  purchase(tournamentId: string, userId: string, powerupId: string): Promise<PurchaseResult>;
}

export function makeShopService(deps: ShopServiceDeps): ShopService {
  return {
    async listForUser(tournamentId, userId) {
      const [catalog, owned] = await Promise.all([
        deps.powerups.listByTournament(tournamentId),
        deps.purchases.listByUser(tournamentId, userId),
      ]);
      const ownedPowerupIds = new Set(owned.map((p) => p.powerupId));
      return catalog.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        cost: p.cost,
        owned: ownedPowerupIds.has(p.id),
      }));
    },

    async listInventory(tournamentId, userId) {
      const owned = await deps.purchases.listByUser(tournamentId, userId);
      const items: InventoryItemView[] = [];
      for (const purchase of owned) {
        const powerup = await deps.powerups.findById(purchase.powerupId);
        if (!powerup) continue; // deleted since purchase (cascades in practice, defensive here)
        items.push({
          id: purchase.id,
          powerupId: powerup.id,
          name: powerup.name,
          description: powerup.description,
          cost: purchase.costPaid,
          purchasedAt: purchase.createdAt.toISOString(),
        });
      }
      return items;
    },

    async purchase(tournamentId, userId, powerupId) {
      const powerup = await deps.powerups.findById(powerupId);
      if (!powerup || powerup.tournamentId !== tournamentId) {
        throw new NotFoundError("Powerup not found");
      }

      const already = await deps.purchases.findByUserAndPowerup(userId, powerupId);
      if (already) throw new ValidationError("You already own this powerup");

      const balance = await deps.coinLedger.sumByUser(tournamentId, userId);
      if (balance < powerup.cost) throw new ValidationError("Not enough coins to buy this powerup");

      let purchase!: PurchaseRecord;
      await deps.uow.run(async () => {
        purchase = await deps.purchases.create({
          tournamentId,
          userId,
          powerupId,
          costPaid: powerup.cost,
        });
        await deps.coinLedger.create({
          tournamentId,
          userId,
          delta: -powerup.cost,
          reason: "purchase",
          purchaseId: purchase.id,
          note: powerup.name,
        });
      });

      const newBalance = await deps.coinLedger.sumByUser(tournamentId, userId);
      return {
        purchase: {
          id: purchase.id,
          powerupId: powerup.id,
          name: powerup.name,
          description: powerup.description,
          cost: purchase.costPaid,
          purchasedAt: purchase.createdAt.toISOString(),
        },
        balance: newBalance,
      };
    },
  };
}
