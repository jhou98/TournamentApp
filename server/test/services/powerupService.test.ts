import { beforeEach, describe, expect, it } from "vitest";
import { makePowerupService, type PowerupService } from "../../src/services/powerupService.js";
import type { NewPowerup, PowerupRecord, PowerupRepo, PowerupUpdate } from "../../src/ports/index.js";

const TID = "t1";

interface Stores {
  powerups: PowerupRecord[];
  seq: number;
}

function freshStores(): Stores {
  return { powerups: [], seq: 0 };
}

function buildService(stores: Stores): PowerupService {
  const powerups: PowerupRepo = {
    async create(p: NewPowerup) {
      const rec: PowerupRecord = {
        id: `p${++stores.seq}`,
        tournamentId: p.tournamentId,
        name: p.name,
        description: p.description,
        cost: p.cost,
        createdAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
        updatedAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
      };
      stores.powerups.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const p = stores.powerups.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async listByTournament(tournamentId) {
      return stores.powerups
        .filter((p) => p.tournamentId === tournamentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((p) => ({ ...p }));
    },
    async update(id, patch: PowerupUpdate) {
      const p = stores.powerups.find((x) => x.id === id)!;
      Object.assign(p, patch);
      p.updatedAt = new Date("2026-03-01T00:00:00.000Z");
      return { ...p };
    },
    async delete(id) {
      stores.powerups = stores.powerups.filter((x) => x.id !== id);
    },
  };

  return makePowerupService({ powerups });
}

describe("powerupService.create", () => {
  let stores: Stores;
  let service: PowerupService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("creates a powerup with trimmed name/description", async () => {
    const powerup = await service.create({
      tournamentId: TID,
      name: "  Extra Serve  ",
      description: "  Take an extra serve  ",
      cost: 50,
    });
    expect(powerup).toMatchObject({ name: "Extra Serve", description: "Take an extra serve", cost: 50 });
    expect(stores.powerups).toHaveLength(1);
  });

  it("rejects a blank name or description", async () => {
    await expect(service.create({ tournamentId: TID, name: "  ", description: "x", cost: 10 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, name: "x", description: "  ", cost: 10 })).rejects.toThrow();
    expect(stores.powerups).toHaveLength(0);
  });

  it("rejects a non-positive or oversized cost", async () => {
    await expect(service.create({ tournamentId: TID, name: "x", description: "y", cost: 0 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, name: "x", description: "y", cost: -5 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, name: "x", description: "y", cost: 5_000_000_000 })).rejects.toThrow();
    expect(stores.powerups).toHaveLength(0);
  });
});

describe("powerupService.listByTournament", () => {
  it("scopes powerups to the tournament, newest first", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.create({ tournamentId: TID, name: "First", description: "x", cost: 10 });
    await service.create({ tournamentId: TID, name: "Second", description: "x", cost: 10 });
    await service.create({ tournamentId: "otherTournament", name: "Other", description: "x", cost: 10 });

    const list = await service.listByTournament(TID);
    expect(list.map((p) => p.name)).toEqual(["Second", "First"]);
  });
});

describe("powerupService.update / remove", () => {
  let stores: Stores;
  let service: PowerupService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("updates individual fields", async () => {
    const powerup = await service.create({ tournamentId: TID, name: "Old", description: "old desc", cost: 10 });
    const updated = await service.update(TID, powerup.id, { name: "New", cost: 20 });
    expect(updated).toMatchObject({ name: "New", description: "old desc", cost: 20 });
  });

  it("rejects an update with an invalid field", async () => {
    const powerup = await service.create({ tournamentId: TID, name: "Old", description: "old desc", cost: 10 });
    await expect(service.update(TID, powerup.id, { cost: -1 })).rejects.toThrow();
    await expect(service.update(TID, powerup.id, { name: "  " })).rejects.toThrow();
  });

  it("404s an unknown powerup or one from another tournament", async () => {
    await expect(service.update(TID, "nope", { name: "x" })).rejects.toThrow();
    const powerup = await service.create({ tournamentId: TID, name: "x", description: "y", cost: 10 });
    await expect(service.update("otherTournament", powerup.id, { name: "x" })).rejects.toThrow();
    await expect(service.remove("otherTournament", powerup.id)).rejects.toThrow();
  });

  it("removes a powerup", async () => {
    const powerup = await service.create({ tournamentId: TID, name: "x", description: "y", cost: 10 });
    await service.remove(TID, powerup.id);
    expect(stores.powerups).toHaveLength(0);
  });
});
