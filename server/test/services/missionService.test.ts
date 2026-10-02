import { beforeEach, describe, expect, it } from "vitest";
import { makeMissionService, type MissionService } from "../../src/services/missionService.js";
import type {
  MembershipRecord,
  MembershipRepo,
  MissionRecord,
  MissionRepo,
  NewMission,
  UserRecord,
  UserRepo,
} from "../../src/ports/index.js";

const TID = "t1";
const UID = "u1";

interface Stores {
  missions: MissionRecord[];
  memberships: MembershipRecord[];
  users: UserRecord[];
  seq: number;
}

function userRec(id: string, displayName: string): UserRecord {
  return { id, username: id, displayName, passwordHash: "x", isAdmin: false, createdAt: new Date() };
}

function freshStores(): Stores {
  return {
    missions: [],
    memberships: [{ id: "m1", userId: UID, teamId: "teamA", tournamentId: TID, role: "member", createdAt: new Date() }],
    users: [userRec(UID, "Ann")],
    seq: 0,
  };
}

function buildService(stores: Stores): MissionService {
  const missions: MissionRepo = {
    async create(m: NewMission) {
      const rec: MissionRecord = {
        id: `mi${++stores.seq}`,
        tournamentId: m.tournamentId,
        userId: m.userId,
        description: m.description,
        prize: m.prize,
        completed: false,
        completedAt: null,
        createdAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
      };
      stores.missions.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const m = stores.missions.find((x) => x.id === id);
      return m ? { ...m } : null;
    },
    async listByTournament(tournamentId) {
      return stores.missions
        .filter((m) => m.tournamentId === tournamentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((m) => ({ ...m }));
    },
    async listByUser(tournamentId, userId) {
      return stores.missions
        .filter((m) => m.tournamentId === tournamentId && m.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((m) => ({ ...m }));
    },
    async markCompleted(id) {
      const m = stores.missions.find((x) => x.id === id)!;
      m.completed = true;
      m.completedAt = new Date("2026-03-01T00:00:00.000Z");
      return { ...m };
    },
    async delete(id) {
      stores.missions = stores.missions.filter((x) => x.id !== id);
    },
  };

  const memberships: MembershipRepo = {
    async findByUserAndTournament(userId, tournamentId) {
      return stores.memberships.find((m) => m.userId === userId && m.tournamentId === tournamentId) ?? null;
    },
    async listByUser() {
      return [];
    },
    async listByTeam() {
      return [];
    },
    async listByTournament() {
      return [];
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
  };

  const users: UserRepo = {
    async create() {
      throw new Error("not used");
    },
    async findById(id) {
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
    async setPassword() {
      throw new Error("not used");
    },
  };

  return makeMissionService({ missions, memberships, users });
}

describe("missionService.create", () => {
  let stores: Stores;
  let service: MissionService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("creates a mission and resolves the player's name", async () => {
    const mission = await service.create({
      tournamentId: TID,
      userId: UID,
      description: "  Do a backflip  ",
      prize: "  50 coins  ",
    });
    expect(mission).toMatchObject({ userId: UID, playerName: "Ann", description: "Do a backflip", prize: "50 coins" });
    expect(stores.missions).toHaveLength(1);
  });

  it("rejects a blank description or prize", async () => {
    await expect(service.create({ tournamentId: TID, userId: UID, description: "  ", prize: "x" })).rejects.toThrow();
    await expect(service.create({ tournamentId: TID, userId: UID, description: "x", prize: "  " })).rejects.toThrow();
    expect(stores.missions).toHaveLength(0);
  });

  it("rejects a target who isn't in the tournament", async () => {
    await expect(
      service.create({ tournamentId: TID, userId: "stranger", description: "x", prize: "y" }),
    ).rejects.toThrow();
    expect(stores.missions).toHaveLength(0);
  });
});

describe("missionService.listByTournament / listForUser", () => {
  it("scopes correctly and resolves player names for the admin view", async () => {
    const stores = freshStores();
    stores.memberships.push({ id: "m2", userId: "u2", teamId: "teamB", tournamentId: TID, role: "member", createdAt: new Date() });
    stores.users.push(userRec("u2", "Bob"));
    const service = buildService(stores);

    await service.create({ tournamentId: TID, userId: UID, description: "Ace serve", prize: "Bragging rights" });
    await service.create({ tournamentId: TID, userId: "u2", description: "Trick shot", prize: "20 coins" });

    const all = await service.listByTournament(TID);
    expect(all.map((m) => m.playerName).sort()).toEqual(["Ann", "Bob"]);

    const mine = await service.listForUser(TID, UID);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ description: "Ace serve", prize: "Bragging rights" });
    expect(mine[0]).not.toHaveProperty("playerName");
  });
});

describe("missionService.remove / complete", () => {
  let stores: Stores;
  let service: MissionService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("lets an admin remove a mission outright", async () => {
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await service.remove(TID, mission.id);
    expect(stores.missions).toHaveLength(0);
  });

  it("lets the assigned player complete their own mission — kept, flagged completed, dropped from their list", async () => {
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await service.complete(TID, UID, mission.id);

    expect(stores.missions).toHaveLength(1);
    expect(stores.missions[0]!.completed).toBe(true);
    expect(await service.listForUser(TID, UID)).toHaveLength(0);

    const adminView = await service.listByTournament(TID);
    expect(adminView).toHaveLength(1);
    expect(adminView[0]!.completed).toBe(true);
  });

  it("refuses to let another player complete someone else's mission", async () => {
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await expect(service.complete(TID, "u2", mission.id)).rejects.toThrow();
    expect(stores.missions[0]!.completed).toBe(false);
  });

  it("refuses to complete an already-completed mission", async () => {
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await service.complete(TID, UID, mission.id);
    await expect(service.complete(TID, UID, mission.id)).rejects.toThrow(/already completed/i);
  });

  it("lets an admin remove a completed mission", async () => {
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await service.complete(TID, UID, mission.id);
    await service.remove(TID, mission.id);
    expect(stores.missions).toHaveLength(0);
  });

  it("404s an unknown mission or one from another tournament", async () => {
    await expect(service.remove(TID, "nope")).rejects.toThrow();
    const mission = await service.create({ tournamentId: TID, userId: UID, description: "x", prize: "y" });
    await expect(service.remove("otherTournament", mission.id)).rejects.toThrow();
  });
});
