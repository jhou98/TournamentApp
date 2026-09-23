import { describe, expect, it } from "vitest";
import { makeRosterService } from "../../src/services/rosterService.js";
import { ConflictError, ValidationError } from "../../src/domain/errors.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  MembershipRecord,
  MembershipRepo,
  PublicUser,
  TeamRecord,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  TournamentStatus,
  UnitOfWork,
  UserRepo,
} from "../../src/ports/index.js";

const TID = "t1";

const passthroughUow: UnitOfWork = { run: (work) => work() };

let currentStatus: TournamentStatus = "setup";
function tournamentDetail(): TournamentDetail {
  return {
    id: TID,
    name: "Test",
    status: currentStatus,
    teamCount: 4,
    teamSize: 6,
    pairSize: 2,
    pairsPerLineup: 3,
    roundsPerMatchup: 2,
    roundRobinCycles: 1,
    playoffQualifiers: 4,
    courtCount: 6,
    coinRule: DEFAULT_COIN_RULE,
    streakRule: DEFAULT_STREAK_RULE,
    shopVisible: true,
    potluckEventAt: null,
    potluckAddress: null,
  };
}

const currentTournament: TournamentRepo = {
  async getDetail(id) {
    return id === TID ? tournamentDetail() : null;
  },
  async list() {
    return [{ id: TID, name: "Test", status: currentStatus, shopVisible: true }];
  },
  async listByIds(ids) {
    return ids.includes(TID) ? [{ id: TID, name: "Test", status: currentStatus, shopVisible: true }] : [];
  },
  async create() {
    throw new Error("not used");
  },
  async setStatus() {
    throw new Error("not used");
  },
  async updateConfig() {
    throw new Error("not used");
  },
  async updateRules() {
    throw new Error("not used");
  },
  async setShopVisible() {
    throw new Error("not used");
  },
  async setPotluckDetails() {
    throw new Error("not used");
  },
};

function fakeUsers(seed: PublicUser[]): UserRepo {
  const store = new Map(seed.map((u) => [u.id, { ...u, passwordHash: "x" }]));
  return {
    async create() {
      throw new Error("not used");
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async findByUsername() {
      return null;
    },
    async list() {
      return [...store.values()].map(({ passwordHash: _h, ...rest }) => rest);
    },
    async setAdmin(id, isAdmin) {
      const u = store.get(id)!;
      u.isAdmin = isAdmin;
      const { passwordHash: _h, ...rest } = u;
      return rest;
    },
  };
}

function fakeTeams(seed: TeamRecord[]): TeamRepo {
  const store = [...seed];
  return {
    async create(tournamentId, name) {
      const rec = { id: `team${store.length + 1}`, tournamentId, name, createdAt: new Date() };
      store.push(rec);
      return rec;
    },
    async findById(id) {
      return store.find((t) => t.id === id) ?? null;
    },
    async findByName(tournamentId, name) {
      return store.find((t) => t.tournamentId === tournamentId && t.name === name) ?? null;
    },
    async listByTournament(tournamentId) {
      return store.filter((t) => t.tournamentId === tournamentId);
    },
    async delete(id) {
      const i = store.findIndex((t) => t.id === id);
      if (i >= 0) store.splice(i, 1);
    },
  };
}

function fakeMemberships(): MembershipRepo & { store: MembershipRecord[] } {
  const store: MembershipRecord[] = [];
  const key = (userId: string, tournamentId: string) => `${userId}:${tournamentId}`;
  const index = new Map<string, MembershipRecord>();
  return {
    store,
    async findByUserAndTournament(userId, tournamentId) {
      return index.get(key(userId, tournamentId)) ?? null;
    },
    async listByUser(userId) {
      return store.filter((m) => m.userId === userId);
    },
    async listByTeam(teamId) {
      return store.filter((m) => m.teamId === teamId);
    },
    async listByTournament(tournamentId) {
      return store.filter((m) => m.tournamentId === tournamentId);
    },
    async assign(userId, tournamentId, teamId, role) {
      let rec = index.get(key(userId, tournamentId));
      if (rec) {
        rec.teamId = teamId;
        rec.role = role;
      } else {
        rec = { id: `m${store.length + 1}`, userId, tournamentId, teamId, role, createdAt: new Date() };
        store.push(rec);
        index.set(key(userId, tournamentId), rec);
      }
      return rec;
    },
    async setRole(userId, tournamentId, role) {
      const rec = index.get(key(userId, tournamentId))!;
      rec.role = role;
      return rec;
    },
    async removeByUserAndTournament(userId, tournamentId) {
      const k = key(userId, tournamentId);
      const rec = index.get(k);
      if (rec) {
        index.delete(k);
        store.splice(store.indexOf(rec), 1);
      }
    },
  };
}

function player(id: string, isAdmin = false): PublicUser {
  return { id, username: id, displayName: id, isAdmin, createdAt: new Date() };
}

function build(users: UserRepo, teams: TeamRepo, memberships: MembershipRepo) {
  return makeRosterService({
    users,
    teams,
    memberships,
    invites: {
      async create(input) {
        return { id: "i1", usedBy: null, usedAt: null, ...input };
      },
      async findByCode() {
        return null;
      },
      async markUsed() {},
    },
    tournaments: currentTournament,
    uow: passthroughUow,
    generateCode: () => "CODE123",
  });
}

describe("rosterService.setCaptain", () => {
  it("enforces exactly one captain per team", async () => {
    const users = fakeUsers([player("a"), player("b")]);
    const teams = fakeTeams([{ id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() }]);
    const memberships = fakeMemberships();
    const roster = build(users, teams, memberships);

    await roster.assignMember(TID, "a", "team1");
    await roster.assignMember(TID, "b", "team1");

    await roster.setCaptain(TID, "team1", "a");
    expect(memberships.store.find((m) => m.userId === "a")!.role).toBe("captain");

    await roster.setCaptain(TID, "team1", "b");
    expect(memberships.store.find((m) => m.userId === "b")!.role).toBe("captain");
    expect(memberships.store.find((m) => m.userId === "a")!.role).toBe("member");
  });

  it("rejects promoting a non-member", async () => {
    const users = fakeUsers([player("a")]);
    const teams = fakeTeams([{ id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() }]);
    const memberships = fakeMemberships();
    const roster = build(users, teams, memberships);
    await expect(roster.setCaptain(TID, "team1", "a")).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("rosterService.createTeam", () => {
  it("rejects a duplicate name", async () => {
    const users = fakeUsers([]);
    const teams = fakeTeams([{ id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() }]);
    const roster = build(users, teams, fakeMemberships());
    await expect(roster.createTeam(TID, "Alpha")).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("rosterService.removeTeam", () => {
  it("deletes the team and unassigns its players while in setup", async () => {
    currentStatus = "setup";
    const users = fakeUsers([player("a"), player("b")]);
    const teams = fakeTeams([
      { id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() },
      { id: "team2", tournamentId: TID, name: "Beta", createdAt: new Date() },
    ]);
    const memberships = fakeMemberships();
    const roster = build(users, teams, memberships);
    await roster.assignMember(TID, "a", "team1");
    await roster.assignMember(TID, "b", "team1");

    await roster.removeTeam(TID, "team1");

    expect(await teams.findById("team1")).toBeNull();
    expect(memberships.store.filter((m) => m.teamId === "team1")).toHaveLength(0);
  });

  it("refuses to remove a team once out of setup", async () => {
    currentStatus = "round_robin";
    const teams = fakeTeams([{ id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() }]);
    const roster = build(fakeUsers([]), teams, fakeMemberships());
    await expect(roster.removeTeam(TID, "team1")).rejects.toBeInstanceOf(ConflictError);
    currentStatus = "setup";
  });
});

describe("rosterService.autoBalance", () => {
  it("distributes non-admin players across teams and excludes admins", async () => {
    const users = fakeUsers([player("p1"), player("p2"), player("p3"), player("p4"), player("boss", true)]);
    const teams = fakeTeams([
      { id: "team1", tournamentId: TID, name: "Alpha", createdAt: new Date() },
      { id: "team2", tournamentId: TID, name: "Beta", createdAt: new Date() },
    ]);
    const memberships = fakeMemberships();
    const roster = build(users, teams, memberships);

    const result = await roster.autoBalance(TID);

    const assigned = memberships.store.map((m) => m.userId);
    expect(assigned).not.toContain("boss");
    expect(assigned).toHaveLength(4);
    const team1 = result.find((t) => t.id === "team1")!;
    const team2 = result.find((t) => t.id === "team2")!;
    expect(team1.members).toHaveLength(2);
    expect(team2.members).toHaveLength(2);
  });
});
