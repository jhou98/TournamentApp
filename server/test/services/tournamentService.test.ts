import { describe, expect, it } from "vitest";
import { makeTournamentService } from "../../src/services/tournamentService.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../src/domain/errors.js";
import type {
  MembershipRecord,
  MembershipRepo,
  NewTournament,
  PublicUser,
  TournamentDetail,
  TournamentRepo,
  TournamentSummary,
} from "../../src/ports/index.js";

function summary(id: string, name = id): TournamentSummary {
  return { id, name, status: "setup" };
}

function detailFrom(input: NewTournament, id: string): TournamentDetail {
  const { name, coinRule: _c, streakRule: _s, suddenDeathRule: _d, ...config } = input;
  return { id, name, status: "setup", ...config };
}

function fakeTournaments(seed: TournamentSummary[] = []): TournamentRepo & { store: TournamentSummary[] } {
  const store = [...seed];
  return {
    store,
    async getDetail() {
      throw new Error("not used");
    },
    async list() {
      return [...store];
    },
    async listByIds(ids) {
      return store.filter((t) => ids.includes(t.id));
    },
    async create(input) {
      const id = `t${store.length + 1}`;
      store.push(summary(id, input.name));
      return detailFrom(input, id);
    },
    async setStatus() {
      throw new Error("not used");
    },
    async updateConfig() {
      throw new Error("not used");
    },
  };
}

function fakeMemberships(records: MembershipRecord[]): MembershipRepo {
  return {
    async findByUserAndTournament() {
      return null;
    },
    async listByUser(userId) {
      return records.filter((m) => m.userId === userId);
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
    async removeByUserAndTournament() {},
  };
}

const admin: PublicUser = { id: "admin", username: "admin", displayName: "Admin", isAdmin: true, createdAt: new Date() };
const player: PublicUser = { id: "p1", username: "p1", displayName: "P1", isAdmin: false, createdAt: new Date() };

function membership(userId: string, tournamentId: string): MembershipRecord {
  return { id: `m-${userId}-${tournamentId}`, userId, teamId: "team1", tournamentId, role: "member", createdAt: new Date() };
}

describe("tournamentService.listAccessible", () => {
  it("gives admins every tournament", async () => {
    const svc = makeTournamentService({
      tournaments: fakeTournaments([summary("t1"), summary("t2")]),
      memberships: fakeMemberships([]),
    });
    const list = await svc.listAccessible(admin);
    expect(list.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("limits a player to the tournaments they're rostered in", async () => {
    const svc = makeTournamentService({
      tournaments: fakeTournaments([summary("t1"), summary("t2"), summary("t3")]),
      memberships: fakeMemberships([membership("p1", "t2")]),
    });
    const list = await svc.listAccessible(player);
    expect(list.map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("tournamentService.resolveActive", () => {
  const svc = () =>
    makeTournamentService({
      tournaments: fakeTournaments([summary("t1"), summary("t2")]),
      memberships: fakeMemberships([membership("p1", "t1")]),
    });

  it("returns a requested id the caller can access", async () => {
    expect(await svc().resolveActive(admin, "t2")).toBe("t2");
  });

  it("rejects a requested id the caller cannot access", async () => {
    await expect(svc().resolveActive(player, "t2")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("auto-selects the only accessible tournament when none is requested", async () => {
    expect(await svc().resolveActive(player)).toBe("t1");
  });

  it("requires a choice when several are accessible and none is requested", async () => {
    await expect(svc().resolveActive(admin)).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns null when the caller has no accessible tournaments", async () => {
    const empty = makeTournamentService({
      tournaments: fakeTournaments([summary("t1")]),
      memberships: fakeMemberships([]),
    });
    expect(await empty.resolveActive(player)).toBeNull();
  });
});

describe("tournamentService.create", () => {
  it("creates a tournament with default config for an admin", async () => {
    const tournaments = fakeTournaments([]);
    const svc = makeTournamentService({ tournaments, memberships: fakeMemberships([]) });
    const created = await svc.create(admin, { name: "Spring Open" });
    expect(created.name).toBe("Spring Open");
    expect(created.teamCount).toBe(4);
    expect(created.status).toBe("setup");
    expect(tournaments.store).toHaveLength(1);
  });

  it("applies config overrides", async () => {
    const svc = makeTournamentService({ tournaments: fakeTournaments([]), memberships: fakeMemberships([]) });
    const created = await svc.create(admin, { name: "Six", config: { teamCount: 6 } });
    expect(created.teamCount).toBe(6);
  });

  it("rejects a non-admin", async () => {
    const svc = makeTournamentService({ tournaments: fakeTournaments([]), memberships: fakeMemberships([]) });
    await expect(svc.create(player, { name: "Nope" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a blank name", async () => {
    const svc = makeTournamentService({ tournaments: fakeTournaments([]), memberships: fakeMemberships([]) });
    await expect(svc.create(admin, { name: "  " })).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects playoffQualifiers greater than teamCount", async () => {
    const svc = makeTournamentService({ tournaments: fakeTournaments([]), memberships: fakeMemberships([]) });
    await expect(
      svc.create(admin, { name: "Bad", config: { teamCount: 4, playoffQualifiers: 8 } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
