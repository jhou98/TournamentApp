import { beforeEach, describe, expect, it } from "vitest";
import { makeShopService, type ShopService } from "../../src/services/shopService.js";
import type {
  CoinLedgerRepo,
  NewCoinTransaction,
  NewPowerup,
  NewPurchase,
  PowerupRecord,
  PowerupRepo,
  PurchaseRecord,
  PurchaseRepo,
  UnitOfWork,
} from "../../src/ports/index.js";

const TID = "t1";
const UID = "u1";
const passthroughUow: UnitOfWork = { run: (work) => work() };

interface Stores {
  powerups: PowerupRecord[];
  purchases: PurchaseRecord[];
  ledgerRows: NewCoinTransaction[];
  balance: number;
  seq: number;
}

function freshStores(balance = 100): Stores {
  return { powerups: [], purchases: [], ledgerRows: [], balance, seq: 0 };
}

function buildService(stores: Stores): ShopService {
  const powerups: PowerupRepo = {
    async create(p: NewPowerup) {
      const rec: PowerupRecord = {
        id: `p${++stores.seq}`,
        tournamentId: p.tournamentId,
        name: p.name,
        description: p.description,
        cost: p.cost,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      stores.powerups.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const p = stores.powerups.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async listByTournament(tournamentId) {
      return stores.powerups.filter((p) => p.tournamentId === tournamentId).map((p) => ({ ...p }));
    },
    async update() {
      throw new Error("not used");
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const purchases: PurchaseRepo = {
    async create(p: NewPurchase) {
      const rec: PurchaseRecord = {
        id: `pu${++stores.seq}`,
        tournamentId: p.tournamentId,
        userId: p.userId,
        powerupId: p.powerupId,
        costPaid: p.costPaid,
        createdAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
      };
      stores.purchases.push(rec);
      return { ...rec };
    },
    async listByUser(tournamentId, userId) {
      return stores.purchases
        .filter((p) => p.tournamentId === tournamentId && p.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((p) => ({ ...p }));
    },
    async findByUserAndPowerup(userId, powerupId) {
      const p = stores.purchases.find((x) => x.userId === userId && x.powerupId === powerupId);
      return p ? { ...p } : null;
    },
  };

  const coinLedger = {
    async createMany() {
      throw new Error("not used");
    },
    async create(row: NewCoinTransaction) {
      stores.ledgerRows.push(row);
      stores.balance += row.delta;
      return { id: `c${++stores.seq}`, createdAt: new Date(), gameId: null, bountyId: null, missionId: null, ...row } as never;
    },
    async deleteDerivedByTournament() {},
    async sumByUser() {
      return stores.balance;
    },
    async listByUser() {
      return [];
    },
    async sumByTournamentGroupedByUser() {
      return [];
    },
  } satisfies CoinLedgerRepo;

  return makeShopService({ powerups, purchases, coinLedger, uow: passthroughUow });
}

function seedPowerup(stores: Stores, cost: number, name = "Extra Serve"): PowerupRecord {
  const p: PowerupRecord = {
    id: `p${++stores.seq}`,
    tournamentId: TID,
    name,
    description: "desc",
    cost,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  stores.powerups.push(p);
  return p;
}

describe("shopService.listForUser", () => {
  it("marks owned powerups", async () => {
    const stores = freshStores();
    const p1 = seedPowerup(stores, 10, "A");
    const p2 = seedPowerup(stores, 20, "B");
    stores.purchases.push({ id: "pu1", tournamentId: TID, userId: UID, powerupId: p1.id, costPaid: 10, createdAt: new Date() });

    const service = buildService(stores);
    const list = await service.listForUser(TID, UID);
    expect(list.find((x) => x.id === p1.id)?.owned).toBe(true);
    expect(list.find((x) => x.id === p2.id)?.owned).toBe(false);
  });
});

describe("shopService.purchase", () => {
  let stores: Stores;
  let service: ShopService;

  beforeEach(() => {
    stores = freshStores(100);
    service = buildService(stores);
  });

  it("buys a powerup, debits coins and records the purchase", async () => {
    const p = seedPowerup(stores, 30);
    const result = await service.purchase(TID, UID, p.id);

    expect(result.balance).toBe(70);
    expect(result.purchase).toMatchObject({ powerupId: p.id, name: p.name, cost: 30 });
    expect(stores.ledgerRows).toEqual([
      { tournamentId: TID, userId: UID, delta: -30, reason: "purchase", purchaseId: result.purchase.id, note: p.name },
    ]);
  });

  it("refuses to buy the same powerup twice", async () => {
    const p = seedPowerup(stores, 10);
    await service.purchase(TID, UID, p.id);
    await expect(service.purchase(TID, UID, p.id)).rejects.toThrow(/already own/i);
  });

  it("refuses a purchase without enough coins", async () => {
    const p = seedPowerup(stores, 500);
    await expect(service.purchase(TID, UID, p.id)).rejects.toThrow(/not enough coins/i);
    expect(stores.purchases).toHaveLength(0);
  });

  it("404s an unknown powerup or one from another tournament", async () => {
    await expect(service.purchase(TID, UID, "nope")).rejects.toThrow();
    const p = seedPowerup(stores, 10);
    await expect(service.purchase("otherTournament", UID, p.id)).rejects.toThrow();
  });
});

describe("shopService.listInventory", () => {
  it("returns owned powerups with purchase price and date", async () => {
    const stores = freshStores(100);
    const p = seedPowerup(stores, 40, "Shield");
    const service = buildService(stores);
    await service.purchase(TID, UID, p.id);

    const inventory = await service.listInventory(TID, UID);
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({ powerupId: p.id, name: "Shield", cost: 40 });
  });
});
