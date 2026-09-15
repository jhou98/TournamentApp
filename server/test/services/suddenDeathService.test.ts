import { beforeEach, describe, expect, it } from "vitest";
import { makeSuddenDeathService, type SuddenDeathService } from "../../src/services/suddenDeathService.js";
import { ConflictError, ForbiddenError, ValidationError } from "../../src/domain/errors.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  GameRecord,
  GameRepo,
  MatchupRecord,
  MatchupRepo,
  MembershipRecord,
  MembershipRepo,
  PublicUser,
  SuddenDeathRecord,
  SuddenDeathRepo,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
  UserRecord,
  UserRepo,
} from "../../src/ports/index.js";

const TID = "t1";
const MID = "final1";
const TA = "teamA";
const TB = "teamB";
const passthroughUow: UnitOfWork = { run: (work) => work() };

function detail(): TournamentDetail {
  return {
    id: TID,
    name: "Test",
    status: "playoffs",
    teamCount: 2,
    teamSize: 2,
    pairSize: 2,
    pairsPerLineup: 1,
    roundsPerMatchup: 2, // 2 games total -> a 1–1 tie is possible
    roundRobinCycles: 1,
    playoffQualifiers: 2,
    courtCount: 2,
    coinRule: DEFAULT_COIN_RULE,
    streakRule: DEFAULT_STREAK_RULE,
  };
}

function user(id: string): UserRecord {
  return { id, username: id, displayName: id.toUpperCase(), passwordHash: "x", isAdmin: false, createdAt: new Date() };
}

interface Stores {
  matchup: MatchupRecord;
  games: GameRecord[];
  memberships: MembershipRecord[];
  users: UserRecord[];
  sd: SuddenDeathRecord | null;
  /** Tournament ids passed to economy.recomputeTournamentLedger, in call order. */
  recomputes: string[];
}

/** A tied matchup: game 1 home wins, game 2 away wins (1–1). Defaults to a final. */
function tiedFinal(stage: MatchupRecord["stage"] = "final"): Stores {
  const matchup: MatchupRecord = {
    id: MID,
    tournamentId: TID,
    stage,
    roundIndex: stage === "round_robin" ? 1 : null,
    bracketSlot: stage === "round_robin" ? null : "F",
    teamAId: TA,
    teamBId: TB,
    status: "in_progress",
    winnerTeamId: null,
  };
  const games: GameRecord[] = [
    { id: "g1", matchupId: MID, roundNo: 1, courtId: "c1", homePairId: "ph1", awayPairId: "pa1", scoreHome: 21, scoreAway: 10, winnerPairId: "ph1", status: "final" },
    { id: "g2", matchupId: MID, roundNo: 2, courtId: "c1", homePairId: "ph2", awayPairId: "pa2", scoreHome: 10, scoreAway: 21, winnerPairId: "pa2", status: "final" },
  ];
  const memberships: MembershipRecord[] = [
    { id: "m-a1", userId: "a1", teamId: TA, tournamentId: TID, role: "captain", createdAt: new Date() },
    { id: "m-a2", userId: "a2", teamId: TA, tournamentId: TID, role: "member", createdAt: new Date() },
    { id: "m-b1", userId: "b1", teamId: TB, tournamentId: TID, role: "captain", createdAt: new Date() },
    { id: "m-b2", userId: "b2", teamId: TB, tournamentId: TID, role: "member", createdAt: new Date() },
  ];
  return { matchup, games, memberships, users: ["a1", "a2", "b1", "b2"].map(user), sd: null, recomputes: [] };
}

function buildService(stores: Stores): SuddenDeathService {
  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === TID ? detail() : null;
    },
    async list() {
      const t = detail();
      return [{ id: t.id, name: t.name, status: t.status }];
    },
    async listByIds(ids) {
      const t = detail();
      return ids.includes(t.id) ? [{ id: t.id, name: t.name, status: t.status }] : [];
    },
    async create() {
      throw new Error("not used");
    },
    async setStatus() {},
    async updateConfig() {
      throw new Error("not used");
    },
    async updateRules() {
      throw new Error("not used");
    },
  };

  const matchups: MatchupRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async listByTournament() {
      throw new Error("not used");
    },
    async findById(id) {
      return id === MID ? { ...stores.matchup } : null;
    },
    async updateTeams() {
      throw new Error("not used");
    },
    async setResult(id, result) {
      stores.matchup.status = result.status;
      stores.matchup.winnerTeamId = result.winnerTeamId;
      return { ...stores.matchup };
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const teams: TeamRepo = {
    async create() {
      throw new Error("not used");
    },
    async findById(id) {
      return id === TA || id === TB
        ? { id, tournamentId: TID, name: id === TA ? "Alpha" : "Bravo", createdAt: new Date() }
        : null;
    },
    async findByName() {
      return null;
    },
    async listByTournament() {
      throw new Error("not used");
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const memberships: MembershipRepo = {
    async findByUserAndTournament(userId) {
      return stores.memberships.find((m) => m.userId === userId) ?? null;
    },
    async listByUser(userId) {
      return stores.memberships.filter((m) => m.userId === userId);
    },
    async listByTeam(teamId) {
      return stores.memberships.filter((m) => m.teamId === teamId);
    },
    async listByTournament() {
      return [...stores.memberships];
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
  };

  const games: GameRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async findById() {
      return null;
    },
    async listByMatchup(matchupId) {
      return stores.games.filter((g) => g.matchupId === matchupId);
    },
    async listByTournament() {
      return [...stores.games];
    },
    async setCourt() {
      throw new Error("not used");
    },
    async setScore() {
      throw new Error("not used");
    },
    async assignPairs() {
      throw new Error("not used");
    },
    async clearAssignmentsForRound() {
      throw new Error("not used");
    },
    async countByStatus() {
      return 0;
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const suddenDeath: SuddenDeathRepo = {
    async findByMatchup() {
      return stores.sd ? { ...stores.sd } : null;
    },
    async create(input) {
      stores.sd = {
        id: "sd1",
        matchupId: input.matchupId,
        teamAId: input.teamAId,
        teamBId: input.teamBId,
        teamARep: null,
        teamBRep: null,
        scoreA: null,
        scoreB: null,
        winnerTeamId: null,
      };
      return { ...stores.sd };
    },
    async setRep(_matchupId, side, userId) {
      if (side === "A") stores.sd!.teamARep = userId;
      else stores.sd!.teamBRep = userId;
      return { ...stores.sd! };
    },
    async setResult(_matchupId, result) {
      stores.sd!.scoreA = result.scoreA;
      stores.sd!.scoreB = result.scoreB;
      stores.sd!.winnerTeamId = result.winnerTeamId;
      return { ...stores.sd! };
    },
    async deleteByTournament() {},
  };

  const economy = {
    async recomputeTournamentLedger(tournamentId: string) {
      stores.recomputes.push(tournamentId);
    },
    async getCoinSummary() {
      return { balance: 0, transactions: [] };
    },
    async getLeaderboard() {
      return { rows: [] };
    },
    async adjustCoins() {
      throw new Error("not used");
    },
    async resetCoins() {
      throw new Error("not used");
    },
    async getRules() {
      throw new Error("not used");
    },
    async updateRules() {
      throw new Error("not used");
    },
  };

  return makeSuddenDeathService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    games,
    suddenDeath,
    economy,
    uow: passthroughUow,
  });
}

const asUser = (id: string, isAdmin = false): PublicUser => ({
  id,
  username: id,
  displayName: id.toUpperCase(),
  isAdmin,
  createdAt: new Date(),
});

async function pickBothReps(service: SuddenDeathService) {
  await service.chooseRep(TID, asUser("a1"), MID, { teamId: TA, userId: "a2" });
  await service.chooseRep(TID, asUser("b1"), MID, { teamId: TB, userId: "b2" });
}

describe("suddenDeathService.getState", () => {
  it("is active for a tied playoff matchup and lists eligible players", async () => {
    const stores = tiedFinal();
    const service = buildService(stores);
    const state = await service.getState(TID, asUser("a1"), MID);
    expect(state.active).toBe(true);
    expect(state.teamA.eligible.map((p) => p.id).sort()).toEqual(["a1", "a2"]);
    expect(state.teamA.rep).toBeNull();
    expect(state.result).toBeNull();
  });

  it("is also active for a tied round-robin matchup (ties are no longer allowed)", async () => {
    const stores = tiedFinal("round_robin");
    const service = buildService(stores);
    const state = await service.getState(TID, asUser("a1"), MID);
    expect(state.active).toBe(true);
  });
});

describe("suddenDeathService.chooseRep", () => {
  let stores: Stores;
  let service: SuddenDeathService;
  beforeEach(() => {
    stores = tiedFinal();
    service = buildService(stores);
  });

  it("lets a captain pick a rep from their roster", async () => {
    await service.chooseRep(TID, asUser("a1"), MID, { teamId: TA, userId: "a2" });
    expect(stores.sd?.teamARep).toBe("a2");
  });

  it("rejects a non-captain", async () => {
    await expect(
      service.chooseRep(TID, asUser("a2"), MID, { teamId: TA, userId: "a1" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects a rep who is not on the team", async () => {
    await expect(
      service.chooseRep(TID, asUser("a1"), MID, { teamId: TA, userId: "b2" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("suddenDeathService.enterResult", () => {
  let stores: Stores;
  let service: SuddenDeathService;
  beforeEach(() => {
    stores = tiedFinal();
    service = buildService(stores);
  });

  it("records the winner and finalizes the matchup", async () => {
    await pickBothReps(service);
    await service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 5, scoreB: 3 });
    expect(stores.sd?.winnerTeamId).toBe(TA);
    expect(stores.matchup.status).toBe("final");
    expect(stores.matchup.winnerTeamId).toBe(TA);
  });

  it("recomputes the coin ledger when the sudden-death result finalizes the matchup", async () => {
    await pickBothReps(service);
    await service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 5, scoreB: 3 });
    expect(stores.recomputes).toEqual([TID]);
  });

  it("lets an admin edit an already-recorded result", async () => {
    await pickBothReps(service);
    await service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 5, scoreB: 3 });
    expect(stores.matchup.winnerTeamId).toBe(TA);

    // Corrected: teamB actually won.
    await service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 3, scoreB: 5 });
    expect(stores.sd?.winnerTeamId).toBe(TB);
    expect(stores.matchup.winnerTeamId).toBe(TB);
  });

  it("requires both reps first", async () => {
    await service.chooseRep(TID, asUser("a1"), MID, { teamId: TA, userId: "a2" });
    await expect(
      service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 5, scoreB: 3 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a non-admin", async () => {
    await pickBothReps(service);
    await expect(
      service.enterResult(TID, asUser("a1"), MID, { scoreA: 5, scoreB: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("enforces the first-to-5 win-by-2 (cap 7) rule", async () => {
    await pickBothReps(service);
    // Winner didn't reach 5.
    await expect(
      service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 4, scoreB: 2 }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Win-by-2 not met and not capped.
    await expect(
      service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 5, scoreB: 4 }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Over the cap.
    await expect(
      service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 8, scoreB: 3 }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Capped 7–6 is allowed.
    await service.enterResult(TID, asUser("admin1", true), MID, { scoreA: 7, scoreB: 6 });
    expect(stores.matchup.winnerTeamId).toBe(TA);
  });
});
