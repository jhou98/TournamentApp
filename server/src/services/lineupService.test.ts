import { beforeEach, describe, expect, it } from "vitest";
import { makeLineupService, type LineupService } from "./lineupService.js";
import { ConflictError, ForbiddenError, ValidationError } from "../domain/errors.js";
import type {
  CourtRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRecord,
  MatchupRepo,
  MembershipRecord,
  MembershipRepo,
  PublicUser,
  TeamRecord,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
  UserRecord,
  UserRepo,
} from "../ports/index.js";

const TID = "t1";
const MID = "m1";
const TA = "teamA";
const TB = "teamB";
const passthroughUow: UnitOfWork = { run: (work) => work() };

const A_ROSTER = ["ca", "a1", "a2", "a3", "a4", "a5"];
const B_ROSTER = ["cb", "b1", "b2", "b3", "b4", "b5"];
const A_PAIRS = [["ca", "a1"], ["a2", "a3"], ["a4", "a5"]];
const B_PAIRS = [["cb", "b1"], ["b2", "b3"], ["b4", "b5"]];

interface Stores {
  tournament: TournamentDetail;
  teams: TeamRecord[];
  memberships: MembershipRecord[];
  users: UserRecord[];
  games: GameRecord[];
  lineups: LineupWithPairs[];
}

function detail(): TournamentDetail {
  return {
    id: TID,
    name: "Test",
    status: "round_robin",
    teamCount: 2,
    teamSize: 6,
    pairSize: 2,
    pairsPerLineup: 3,
    roundsPerMatchup: 2,
    roundRobinCycles: 1,
    playoffQualifiers: 2,
    courtCount: 6,
  };
}

function user(id: string, isAdmin = false): UserRecord {
  return {
    id,
    username: id,
    displayName: id.toUpperCase(),
    passwordHash: "x",
    isAdmin,
    createdAt: new Date(),
  };
}

function membership(userId: string, teamId: string, role: "captain" | "member"): MembershipRecord {
  return { id: `mem-${userId}`, userId, teamId, tournamentId: TID, role, createdAt: new Date() };
}

function freshStores(): Stores {
  const teams: TeamRecord[] = [
    { id: TA, tournamentId: TID, name: "Alpha", createdAt: new Date() },
    { id: TB, tournamentId: TID, name: "Bravo", createdAt: new Date() },
  ];
  const users = [
    ...A_ROSTER.map((id) => user(id)),
    ...B_ROSTER.map((id) => user(id)),
    user("admin1", true),
  ];
  const memberships = [
    ...A_ROSTER.map((id, i) => membership(id, TA, i === 0 ? "captain" : "member")),
    ...B_ROSTER.map((id, i) => membership(id, TB, i === 0 ? "captain" : "member")),
  ];
  // 2 rounds x 3 pairs = 6 games, pre-created awaiting_lineups.
  const games: GameRecord[] = [];
  let seq = 0;
  for (const roundNo of [1, 2]) {
    for (let s = 0; s < 3; s++) {
      games.push({
        id: `g${++seq}`,
        matchupId: MID,
        roundNo,
        courtId: `court${s + 1}`,
        homePairId: null,
        awayPairId: null,
        scoreHome: null,
        scoreAway: null,
        winnerPairId: null,
        status: "awaiting_lineups",
      });
    }
  }
  return { tournament: detail(), teams, memberships, users, games, lineups: [] };
}

function buildService(stores: Stores, rng?: () => number): LineupService {
  let pairSeq = 0;

  const tournaments: TournamentRepo = {
    async getCurrent() {
      return { id: TID, name: "Test" };
    },
    async getCurrentDetail() {
      return { ...stores.tournament };
    },
    async setStatus() {
      throw new Error("not used");
    },
    async updateConfig() {
      throw new Error("not used");
    },
  };

  const matchup: MatchupRecord = {
    id: MID,
    tournamentId: TID,
    stage: "round_robin",
    roundIndex: 1,
    teamAId: TA,
    teamBId: TB,
    status: "scheduled",
    winnerTeamId: null,
  };

  const matchups: MatchupRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async listByTournament() {
      return [
        {
          ...matchup,
          teamAName: "Alpha",
          teamBName: "Bravo",
          games: stores.games.map((g) => ({
            id: g.id,
            roundNo: g.roundNo,
            courtId: g.courtId,
            status: g.status,
          })),
        },
      ];
    },
    async findById(id) {
      return id === MID ? matchup : null;
    },
    async updateTeams() {
      throw new Error("not used");
    },
    async setResult() {
      throw new Error("not used");
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
      return stores.teams.find((t) => t.id === id) ?? null;
    },
    async findByName() {
      return null;
    },
    async listByTournament(tid) {
      return stores.teams.filter((t) => t.tournamentId === tid);
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const memberships: MembershipRepo = {
    async findByUserAndTournament(userId, tid) {
      return stores.memberships.find((m) => m.userId === userId && m.tournamentId === tid) ?? null;
    },
    async listByTeam(teamId) {
      return stores.memberships.filter((m) => m.teamId === teamId);
    },
    async listByTournament(tid) {
      return stores.memberships.filter((m) => m.tournamentId === tid);
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

  const courts: CourtRepo = {
    async listByTournament(tid) {
      return [1, 2, 3, 4, 5, 6].map((n) => ({ id: `court${n}`, tournamentId: tid, label: `Court ${n}` }));
    },
    async findById() {
      return null;
    },
    async createMany() {
      throw new Error("not used");
    },
    async rename() {
      throw new Error("not used");
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const lineups: LineupRepo = {
    async findByRound(matchupId, teamId, roundNo) {
      return (
        stores.lineups.find(
          (l) => l.matchupId === matchupId && l.teamId === teamId && l.roundNo === roundNo,
        ) ?? null
      );
    },
    async listByMatchup(matchupId) {
      return stores.lineups.filter((l) => l.matchupId === matchupId);
    },
    async listByTeam(teamId) {
      return stores.lineups.filter((l) => l.teamId === teamId);
    },
    async findById(id) {
      return stores.lineups.find((l) => l.id === id) ?? null;
    },
    async save(input) {
      let lineup = stores.lineups.find(
        (l) => l.matchupId === input.matchupId && l.teamId === input.teamId && l.roundNo === input.roundNo,
      );
      if (!lineup) {
        lineup = {
          id: `lineup-${input.teamId}-${input.roundNo}`,
          matchupId: input.matchupId,
          teamId: input.teamId,
          roundNo: input.roundNo,
          submittedBy: input.submittedBy,
          locked: false,
          lockedAt: null,
          pairs: [],
        };
        stores.lineups.push(lineup);
      }
      lineup.submittedBy = input.submittedBy;
      lineup.pairs = input.pairs.map((p) => ({
        id: `pair-${++pairSeq}`,
        lineupId: lineup!.id,
        slot: p.slot,
        playerIds: p.playerIds,
      }));
      return { ...lineup, pairs: [...lineup.pairs] };
    },
    async setLocked(id, locked) {
      const l = stores.lineups.find((x) => x.id === id)!;
      l.locked = locked;
      l.lockedAt = locked ? new Date() : null;
      return l;
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  const games: GameRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async findById(id) {
      return stores.games.find((g) => g.id === id) ?? null;
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
    async assignPairs(assignments) {
      for (const a of assignments) {
        const g = stores.games.find((x) => x.id === a.gameId)!;
        g.homePairId = a.homePairId;
        g.awayPairId = a.awayPairId;
        g.status = "assigned";
      }
    },
    async clearAssignmentsForRound(matchupId, roundNo) {
      for (const g of stores.games) {
        if (g.matchupId === matchupId && g.roundNo === roundNo && g.status !== "final") {
          g.homePairId = null;
          g.awayPairId = null;
          g.status = "awaiting_lineups";
        }
      }
    },
    async countByStatus() {
      return 0;
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
  };

  return makeLineupService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    courts,
    lineups,
    games,
    uow: passthroughUow,
    ...(rng ? { rng } : {}),
  });
}

const asUser = (id: string, isAdmin = false): PublicUser => ({
  id,
  username: id,
  displayName: id.toUpperCase(),
  isAdmin,
  createdAt: new Date(),
});

async function submitBoth(service: LineupService, stores: Stores, roundNo = 1) {
  await service.submit(asUser("ca"), { matchupId: MID, teamId: TA, roundNo, pairs: A_PAIRS });
  await service.submit(asUser("cb"), { matchupId: MID, teamId: TB, roundNo, pairs: B_PAIRS });
}

describe("lineupService.submit", () => {
  let stores: Stores;
  let service: LineupService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("lets a captain submit a valid lineup, unlocked", async () => {
    const lineup = await service.submit(asUser("ca"), {
      matchupId: MID,
      teamId: TA,
      roundNo: 1,
      pairs: A_PAIRS,
    });
    expect(lineup.pairs).toHaveLength(3);
    expect(lineup.locked).toBe(false);
    expect(stores.lineups).toHaveLength(1);
  });

  it("rejects a non-captain of the team", async () => {
    await expect(
      service.submit(asUser("a1"), { matchupId: MID, teamId: TA, roundNo: 1, pairs: A_PAIRS }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects the opposing team's captain acting on the other side", async () => {
    await expect(
      service.submit(asUser("cb"), { matchupId: MID, teamId: TA, roundNo: 1, pairs: A_PAIRS }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects an invalid lineup (player not on the roster)", async () => {
    await expect(
      service.submit(asUser("ca"), {
        matchupId: MID,
        teamId: TA,
        roundNo: 1,
        pairs: [["ca", "b1"], ["a2", "a3"], ["a4", "a5"]],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects reusing a pairing from another round of the same matchup", async () => {
    await service.submit(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1, pairs: A_PAIRS });
    await expect(
      service.submit(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 2, pairs: A_PAIRS }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to edit a locked lineup", async () => {
    await service.submit(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1, pairs: A_PAIRS });
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    await expect(
      service.submit(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1, pairs: A_PAIRS }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("lets an admin submit on a team's behalf", async () => {
    const lineup = await service.submit(asUser("admin1", true), {
      matchupId: MID,
      teamId: TA,
      roundNo: 1,
      pairs: A_PAIRS,
    });
    expect(lineup.pairs).toHaveLength(3);
  });
});

describe("lineupService.lock + random assignment", () => {
  let stores: Stores;
  let service: LineupService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores, () => 0);
  });

  it("does not assign until both sides lock", async () => {
    await submitBoth(service, stores);
    const first = await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    expect(first.assigned).toBe(false);
    expect(stores.games.filter((g) => g.roundNo === 1).every((g) => g.status === "awaiting_lineups")).toBe(
      true,
    );
  });

  it("assigns the round once the second side locks", async () => {
    await submitBoth(service, stores);
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    const second = await service.lock(asUser("cb"), { matchupId: MID, teamId: TB, roundNo: 1 });

    expect(second.assigned).toBe(true);
    const round1 = stores.games.filter((g) => g.roundNo === 1);
    expect(round1.every((g) => g.status === "assigned")).toBe(true);
    expect(round1.every((g) => g.homePairId && g.awayPairId)).toBe(true);

    // Away pairs are a permutation of team B's three pairs.
    const awayIds = new Set(round1.map((g) => g.awayPairId));
    expect(awayIds.size).toBe(3);
    // Round 2 is untouched.
    expect(stores.games.filter((g) => g.roundNo === 2).every((g) => g.status === "awaiting_lineups")).toBe(
      true,
    );
  });

  it("requires a submitted lineup before locking", async () => {
    await expect(
      service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("lineupService.unlock", () => {
  let stores: Stores;
  let service: LineupService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores, () => 0);
  });

  it("clears the assignment and unlocks (admin only)", async () => {
    await submitBoth(service, stores);
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    await service.lock(asUser("cb"), { matchupId: MID, teamId: TB, roundNo: 1 });

    await service.unlock(asUser("admin1", true), { matchupId: MID, teamId: TA, roundNo: 1 });

    expect(stores.lineups.find((l) => l.teamId === TA && l.roundNo === 1)!.locked).toBe(false);
    expect(stores.games.filter((g) => g.roundNo === 1).every((g) => g.status === "awaiting_lineups")).toBe(
      true,
    );
    expect(stores.games.filter((g) => g.roundNo === 1).every((g) => g.homePairId === null)).toBe(true);
  });

  it("rejects a non-admin", async () => {
    await submitBoth(service, stores);
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    await expect(
      service.unlock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("lineupService.getContext", () => {
  it("hides the opponent's pairs from a captain until revealed", async () => {
    const stores = freshStores();
    const service = buildService(stores, () => 0);
    await submitBoth(service, stores);
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });

    const ctx = await service.getContext(asUser("ca"), MID);
    const round1 = ctx.rounds.find((r) => r.roundNo === 1)!;
    expect(round1.teamA.pairs).not.toBeNull(); // own side visible
    expect(round1.teamB.pairs).toBeNull(); // opponent hidden pre-reveal
    expect(round1.revealed).toBe(false);
    expect(ctx.myTeamId).toBe(TA);
  });

  it("reveals both lineups and game pairings after assignment", async () => {
    const stores = freshStores();
    const service = buildService(stores, () => 0);
    await submitBoth(service, stores);
    await service.lock(asUser("ca"), { matchupId: MID, teamId: TA, roundNo: 1 });
    await service.lock(asUser("cb"), { matchupId: MID, teamId: TB, roundNo: 1 });

    const ctx = await service.getContext(asUser("ca"), MID);
    const round1 = ctx.rounds.find((r) => r.roundNo === 1)!;
    expect(round1.revealed).toBe(true);
    expect(round1.teamB.pairs).not.toBeNull();
    expect(round1.games).toHaveLength(3);
    for (const g of round1.games) {
      expect(g.homePlayers).toHaveLength(2);
      expect(g.awayPlayers).toHaveLength(2);
    }
  });

  it("lists a captain's own matchups", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    const mine = await service.listMyMatchups(asUser("ca"));
    expect(mine).toHaveLength(1);
    expect(mine[0]!.myTeamId).toBe(TA);
  });
});
