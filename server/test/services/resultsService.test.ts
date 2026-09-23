import { beforeEach, describe, expect, it } from "vitest";
import { makeResultsService, type ResultsService } from "../../src/services/resultsService.js";
import type { EconomyService } from "../../src/services/economyService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../src/domain/errors.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  CourtRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
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
} from "../../src/ports/index.js";

const TID = "t1";
const MID = "m1";
const TA = "teamA";
const TB = "teamB";
const passthroughUow: UnitOfWork = { run: (work) => work() };

interface Stores {
  tournament: TournamentDetail;
  teams: TeamRecord[];
  memberships: MembershipRecord[];
  users: UserRecord[];
  games: GameRecord[];
  matchup: MatchupRecord;
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
    coinRule: DEFAULT_COIN_RULE,
    streakRule: DEFAULT_STREAK_RULE,
    shopVisible: true,
    potluckEventAt: null,
    potluckAddress: null,
  };
}

function user(id: string, isAdmin = false): UserRecord {
  return { id, username: id, displayName: id.toUpperCase(), passwordHash: "x", isAdmin, createdAt: new Date() };
}

function freshStores(): Stores {
  const teams: TeamRecord[] = [
    { id: TA, tournamentId: TID, name: "Alpha", createdAt: new Date() },
    { id: TB, tournamentId: TID, name: "Bravo", createdAt: new Date() },
  ];
  const users = [user("a1"), user("a2"), user("b1"), user("b2"), user("admin1", true)];
  const memberships: MembershipRecord[] = [
    { id: "m-a1", userId: "a1", teamId: TA, tournamentId: TID, role: "captain", createdAt: new Date() },
    { id: "m-a2", userId: "a2", teamId: TA, tournamentId: TID, role: "member", createdAt: new Date() },
    { id: "m-b1", userId: "b1", teamId: TB, tournamentId: TID, role: "captain", createdAt: new Date() },
    { id: "m-b2", userId: "b2", teamId: TB, tournamentId: TID, role: "member", createdAt: new Date() },
  ];
  // 2 rounds x 3 games = 6 games, all pairs already assigned.
  const games: GameRecord[] = [];
  let seq = 0;
  for (const roundNo of [1, 2]) {
    for (let s = 1; s <= 3; s++) {
      const n = ++seq;
      games.push({
        id: `g${n}`,
        matchupId: MID,
        roundNo,
        courtId: `court${s}`,
        homePairId: `pa${n}`,
        awayPairId: `pb${n}`,
        scoreHome: null,
        scoreAway: null,
        winnerPairId: null,
        status: "assigned",
        teamAPowerupUsedBy: null,
        teamBPowerupUsedBy: null,
      });
    }
  }
  const matchup: MatchupRecord = {
    id: MID,
    tournamentId: TID,
    stage: "round_robin",
    roundIndex: 1,
    bracketSlot: null,
    teamAId: TA,
    teamBId: TB,
    status: "scheduled",
    winnerTeamId: null,
  };
  return { tournament: detail(), teams, memberships, users, games, matchup };
}

function buildService(stores: Stores): ResultsService {
  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === TID ? { ...stores.tournament } : null;
    },
    async list() {
      const { id, name, status, shopVisible } = stores.tournament;
      return [{ id, name, status, shopVisible }];
    },
    async listByIds(ids) {
      const { id, name, status, shopVisible } = stores.tournament;
      return ids.includes(id) ? [{ id, name, status, shopVisible }] : [];
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
    async setShopVisible() {
      throw new Error("not used");
    },
    async setPotluckDetails() {
      throw new Error("not used");
    },
  };

  const matchups: MatchupRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async listByTournament() {
      return [
        {
          ...stores.matchup,
          teamAName: "Alpha",
          teamBName: "Bravo",
          games: stores.games.map((g) => ({ id: g.id, roundNo: g.roundNo, courtId: g.courtId, status: g.status })),
        },
      ];
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
    async listByUser(userId) {
      return stores.memberships.filter((m) => m.userId === userId);
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
      return [1, 2, 3].map((n) => ({ id: `court${n}`, tournamentId: tid, label: `Court ${n}` }));
    },
    async findById(id) {
      return id.startsWith("court") ? { id, tournamentId: TID, label: id } : null;
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
    async findByRound() {
      return null;
    },
    async listByMatchup() {
      // Minimal pairs so getResults can resolve player names.
      return stores.games.flatMap((g) => [
        {
          id: `l-${g.id}`,
          matchupId: MID,
          teamId: TA,
          roundNo: g.roundNo,
          submittedBy: "a1",
          locked: true,
          lockedAt: new Date(),
          pairs: [{ id: g.homePairId!, lineupId: `l-${g.id}`, slot: 1, playerIds: ["a1", "a2"] }],
        },
      ]);
    },
    async listByTeam() {
      return [];
    },
    async findById() {
      return null;
    },
    async save() {
      throw new Error("not used");
    },
    async setLocked() {
      throw new Error("not used");
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
      const g = stores.games.find((x) => x.id === id);
      return g ? { ...g } : null;
    },
    async listByMatchup(matchupId) {
      return stores.games.filter((g) => g.matchupId === matchupId).map((g) => ({ ...g }));
    },
    async listByTournament() {
      return stores.games.map((g) => ({ ...g }));
    },
    async setCourt() {
      throw new Error("not used");
    },
    async setScore(id, score) {
      const g = stores.games.find((x) => x.id === id)!;
      g.scoreHome = score.scoreHome;
      g.scoreAway = score.scoreAway;
      g.winnerPairId = score.winnerPairId;
      g.status = "final";
      if (score.courtId) g.courtId = score.courtId;
      return { ...g };
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
    async claimPowerupSlot() {
      throw new Error("not used");
    },
  };

  const economy: EconomyService = {
    async recomputeTournamentLedger() {
      // No-op in results-service tests — the ledger recompute itself is
      // covered by economyService.test.ts.
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

  return makeResultsService({
    tournaments,
    matchups,
    teams,
    memberships,
    users,
    courts,
    lineups,
    games,
    uow: passthroughUow,
    economy,
  });
}

const asUser = (id: string, isAdmin = false): PublicUser => ({
  id,
  username: id,
  displayName: id.toUpperCase(),
  isAdmin,
  createdAt: new Date(),
});

/** Score every game so team A wins 4–2 overall. */
async function scoreAll(service: ResultsService, stores: Stores) {
  // Round 1: A wins all 3. Round 2: B wins first 2, A wins last -> A total 4, B total 2.
  const plan: Record<string, [number, number]> = {
    g1: [21, 10],
    g2: [21, 12],
    g3: [21, 15],
    g4: [10, 21],
    g5: [12, 21],
    g6: [21, 18],
  };
  for (const g of stores.games) {
    const [h, a] = plan[g.id]!;
    await service.enterScore(TID, asUser("admin1", true), g.id, { scoreHome: h, scoreAway: a });
  }
}

describe("resultsService.enterScore", () => {
  let stores: Stores;
  let service: ResultsService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("records a score, sets the winning pair, and marks the game final", async () => {
    await service.enterScore(TID, asUser("admin1", true), "g1", { scoreHome: 21, scoreAway: 10 });
    const g = stores.games.find((x) => x.id === "g1")!;
    expect(g.status).toBe("final");
    expect(g.scoreHome).toBe(21);
    expect(g.winnerPairId).toBe("pa1"); // home pair won
    // Matchup not yet decided (only one game final).
    expect(stores.matchup.status).toBe("in_progress");
    expect(stores.matchup.winnerTeamId).toBeNull();
  });

  it("decides the matchup once every game is final", async () => {
    await scoreAll(service, stores);
    expect(stores.matchup.status).toBe("final");
    expect(stores.matchup.winnerTeamId).toBe(TA);
  });

  it("rejects a non-admin", async () => {
    await expect(
      service.enterScore(TID, asUser("a1"), "g1", { scoreHome: 21, scoreAway: 10 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects a tied game score", async () => {
    await expect(
      service.enterScore(TID, asUser("admin1", true), "g1", { scoreHome: 15, scoreAway: 15 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects scoring a game whose pairs are not assigned yet", async () => {
    stores.games[0]!.status = "awaiting_lineups";
    stores.games[0]!.homePairId = null;
    stores.games[0]!.awayPairId = null;
    await expect(
      service.enterScore(TID, asUser("admin1", true), "g1", { scoreHome: 21, scoreAway: 10 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an unknown game", async () => {
    await expect(
      service.enterScore(TID, asUser("admin1", true), "nope", { scoreHome: 21, scoreAway: 10 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("re-decides the matchup when a final result is edited", async () => {
    await scoreAll(service, stores);
    expect(stores.matchup.winnerTeamId).toBe(TA);
    // Flip round-2 games so B now wins 4–2.
    await service.enterScore(TID, asUser("admin1", true), "g1", { scoreHome: 10, scoreAway: 21 });
    await service.enterScore(TID, asUser("admin1", true), "g6", { scoreHome: 18, scoreAway: 21 });
    // Now A wins g2,g3 (2); B wins g1,g4,g5,g6 (4).
    expect(stores.matchup.winnerTeamId).toBe(TB);
  });
});

describe("resultsService.getResults", () => {
  it("reports per-match and overall matchup scores with a named winner", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await scoreAll(service, stores);

    const view = await service.getResults(TID, asUser("a1"));
    const m = view.matchups[0]!;
    expect(m.matchupScore).toEqual({ teamA: 4, teamB: 2 });
    expect(m.decided).toBe(true);
    expect(m.tied).toBe(false);
    expect(m.winnerTeamName).toBe("Alpha");
    const round1 = m.matches.find((r) => r.roundNo === 1)!;
    expect(round1.roundScore).toEqual({ teamA: 3, teamB: 0 });
    const round2 = m.matches.find((r) => r.roundNo === 2)!;
    expect(round2.roundScore).toEqual({ teamA: 1, teamB: 2 });
    expect(round1.games[0]!.homePlayers.map((p) => p.displayName)).toContain("A1");
  });
});

describe("resultsService.getStandings", () => {
  it("ranks the matchup winner first", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await scoreAll(service, stores);

    const { rows } = await service.getStandings(TID);
    expect(rows[0]!.teamId).toBe(TA);
    expect(rows[0]!.matchupsWon).toBe(1);
    expect(rows[0]!.gamesWon).toBe(4);
    expect(rows[0]!.gamesLost).toBe(2);
    expect(rows[0]!.rank).toBe(1);
    expect(rows[1]!.teamId).toBe(TB);
    expect(rows[1]!.matchupsLost).toBe(1);
  });
});
