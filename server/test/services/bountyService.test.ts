import { beforeEach, describe, expect, it } from "vitest";
import { makeBountyService, type BountyService } from "../../src/services/bountyService.js";
import type {
  BountyRecord,
  BountyRepo,
  CoinLedgerRepo,
  MembershipRecord,
  MembershipRepo,
  NewBounty,
  NewCoinTransaction,
  TeamRecord,
  TeamRepo,
  TournamentRepo,
  UnitOfWork,
  UserRecord,
  UserRepo,
} from "../../src/ports/index.js";

const TID = "t1";
const TA = "teamA";
const passthroughUow: UnitOfWork = { run: (work) => work() };

interface Stores {
  bounties: BountyRecord[];
  createdRows: NewCoinTransaction[];
  memberships: MembershipRecord[];
  teams: TeamRecord[];
  users: UserRecord[];
  seq: number;
}

function member(userId: string, teamId: string): MembershipRecord {
  return { id: `m-${userId}`, userId, teamId, tournamentId: TID, role: "member", createdAt: new Date() };
}
function userRec(id: string, displayName: string): UserRecord {
  return { id, username: id, displayName, passwordHash: "x", isAdmin: false, createdAt: new Date() };
}

function freshStores(): Stores {
  return {
    bounties: [],
    createdRows: [],
    memberships: [member("a1", TA), member("a2", TA)],
    teams: [{ id: TA, tournamentId: TID, name: "Alpha", createdAt: new Date() }],
    users: [userRec("a1", "Ann"), userRec("a2", "Abe")],
    seq: 0,
  };
}

function buildService(stores: Stores): BountyService {
  const bounties: BountyRepo = {
    async create(b: NewBounty) {
      const rec: BountyRecord = {
        id: `b${++stores.seq}`,
        tournamentId: b.tournamentId,
        targetType: b.targetType,
        targetId: b.targetId,
        description: b.description,
        coinValue: b.coinValue,
        active: true,
        awardedAt: null,
        createdAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
      };
      stores.bounties.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const b = stores.bounties.find((x) => x.id === id);
      return b ? { ...b } : null;
    },
    async listByTournament(tournamentId) {
      return stores.bounties
        .filter((b) => b.tournamentId === tournamentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((b) => ({ ...b }));
    },
    async markAwarded(id) {
      const b = stores.bounties.find((x) => x.id === id)!;
      b.active = false;
      b.awardedAt = new Date("2026-03-01T00:00:00.000Z");
      return { ...b };
    },
    async delete(id) {
      stores.bounties = stores.bounties.filter((x) => x.id !== id);
    },
  };

  const coinLedger = {
    async createMany(rows: NewCoinTransaction[]) {
      stores.createdRows.push(...rows);
    },
    async create() {
      throw new Error("not used");
    },
    async deleteDerivedByTournament() {},
    async sumByUser() {
      return 0;
    },
    async listByUser() {
      return [];
    },
    async sumByTournamentGroupedByUser() {
      return [];
    },
  } satisfies CoinLedgerRepo;

  const tournaments = {
    async getDetail() {
      return null;
    },
    async list() {
      throw new Error("not used");
    },
    async listByIds() {
      throw new Error("not used");
    },
    async create() {
      throw new Error("not used");
    },
    async setStatus() {},
    async updateConfig() {
      throw new Error("not used");
    },
  } satisfies TournamentRepo;

  const teams = {
    async create() {
      throw new Error("not used");
    },
    async findById(id: string) {
      return stores.teams.find((t) => t.id === id) ?? null;
    },
    async findByName() {
      return null;
    },
    async listByTournament() {
      return stores.teams.map((t) => ({ ...t }));
    },
    async delete() {
      throw new Error("not used");
    },
  } satisfies TeamRepo;

  const memberships = {
    async findByUserAndTournament(userId: string, tournamentId: string) {
      return stores.memberships.find((m) => m.userId === userId && m.tournamentId === tournamentId) ?? null;
    },
    async listByUser() {
      return [];
    },
    async listByTeam(teamId: string) {
      return stores.memberships.filter((m) => m.teamId === teamId).map((m) => ({ ...m }));
    },
    async listByTournament() {
      return stores.memberships.map((m) => ({ ...m }));
    },
    async assign() {
      throw new Error("not used");
    },
    async setRole() {
      throw new Error("not used");
    },
    async removeByUserAndTournament() {
      throw new Error("not used");
    },
  } satisfies MembershipRepo;

  const users = {
    async create() {
      throw new Error("not used");
    },
    async findById(id: string) {
      return stores.users.find((u) => u.id === id) ?? null;
    },
    async findByUsername() {
      return null;
    },
    async list() {
      throw new Error("not used");
    },
    async setAdmin() {
      throw new Error("not used");
    },
  } satisfies UserRepo;

  return makeBountyService({ bounties, coinLedger, tournaments, teams, memberships, users, uow: passthroughUow });
}

describe("bountyService.create", () => {
  let stores: Stores;
  let service: BountyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("creates a player bounty and resolves the player's name", async () => {
    const bounty = await service.create({
      tournamentId: TID,
      targetType: "player",
      targetId: "a1",
      description: "  First to 3 wins  ",
      coinValue: 100,
    });
    expect(bounty).toMatchObject({
      targetType: "player",
      targetId: "a1",
      targetName: "Ann",
      description: "First to 3 wins",
      coinValue: 100,
      active: true,
      awardedAt: null,
    });
    expect(stores.bounties).toHaveLength(1);
  });

  it("creates a team bounty and resolves the team's name", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "team", targetId: TA, description: "Sweep a round", coinValue: 50 });
    expect(bounty).toMatchObject({ targetType: "team", targetName: "Alpha", coinValue: 50 });
  });

  it("rejects a blank description and a non-positive or oversized coin value", async () => {
    await expect(service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "   ", coinValue: 10 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: 0 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: -5 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: 5_000_000_000 })).rejects.toThrow();
    expect(stores.bounties).toHaveLength(0);
  });

  it("rejects a target that isn't in the tournament", async () => {
    await expect(service.create({ tournamentId: TID, targetType: "player", targetId: "stranger", description: "x", coinValue: 10 })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, targetType: "team", targetId: "otherTeam", description: "x", coinValue: 10 })).rejects.toThrow();
    expect(stores.bounties).toHaveLength(0);
  });
});

describe("bountyService.award", () => {
  let stores: Stores;
  let service: BountyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("credits a single player and marks the bounty awarded", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "Ace serve", coinValue: 75 });
    const result = await service.award(TID, bounty.id);

    expect(result.recipients).toBe(1);
    expect(result.bounty.active).toBe(false);
    expect(result.bounty.awardedAt).not.toBeNull();
    expect(stores.createdRows).toEqual([
      { tournamentId: TID, userId: "a1", delta: 75, reason: "bounty", bountyId: bounty.id, note: "Ace serve" },
    ]);
  });

  it("credits every current member of a team target", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "team", targetId: TA, description: "Team sweep", coinValue: 30 });
    const result = await service.award(TID, bounty.id);

    expect(result.recipients).toBe(2);
    expect(stores.createdRows.map((r) => r.userId).sort()).toEqual(["a1", "a2"]);
    expect(stores.createdRows.every((r) => r.delta === 30 && r.reason === "bounty" && r.note === "Team sweep")).toBe(true);
  });

  it("refuses to award the same bounty twice", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: 10 });
    await service.award(TID, bounty.id);
    await expect(service.award(TID, bounty.id)).rejects.toThrow(/already/i);
    expect(stores.createdRows).toHaveLength(1);
  });

  it("refuses a team award when the team has no players", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "team", targetId: TA, description: "x", coinValue: 10 });
    stores.memberships = []; // roster cleared after creation
    await expect(service.award(TID, bounty.id)).rejects.toThrow();
    expect(stores.createdRows).toHaveLength(0);
    // Still active (nothing was awarded).
    expect(stores.bounties[0]!.active).toBe(true);
  });

  it("404s an unknown bounty or one from another tournament", async () => {
    await expect(service.award(TID, "nope")).rejects.toThrow();
    const bounty = await service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: 10 });
    await expect(service.award("otherTournament", bounty.id)).rejects.toThrow();
  });
});

describe("bountyService.listActive / remove", () => {
  let stores: Stores;
  let service: BountyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("listActive hides awarded bounties", async () => {
    const b1 = await service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "keep", coinValue: 10 });
    await service.create({ tournamentId: TID, targetType: "player", targetId: "a2", description: "award", coinValue: 10 });
    await service.award(TID, b1.id);

    const active = await service.listActive(TID);
    expect(active.map((b) => b.description)).toEqual(["award"]);
    // The full list still shows both.
    expect(await service.listByTournament(TID)).toHaveLength(2);
  });

  it("removes a bounty", async () => {
    const bounty = await service.create({ tournamentId: TID, targetType: "player", targetId: "a1", description: "x", coinValue: 10 });
    await service.remove(TID, bounty.id);
    expect(stores.bounties).toHaveLength(0);
  });
});
