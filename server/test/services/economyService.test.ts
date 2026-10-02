import { beforeEach, describe, expect, it } from "vitest";
import { makeEconomyService, type EconomyService } from "../../src/services/economyService.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  CoinBalanceRow,
  CoinLedgerRepo,
  CoinTransactionRecord,
  GameRecord,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRecord,
  MatchupRepo,
  MembershipRecord,
  MembershipRepo,
  NewCoinTransaction,
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

interface Stores {
  tournament: TournamentDetail | null;
  games: GameRecord[];
  lineups: LineupWithPairs[];
  matchups: MatchupRecord[];
  createdRows: NewCoinTransaction[][];
  /** Single-row inserts (admin adjustments). */
  createdSingles: CoinTransactionRecord[];
  deletedFor: string[];
  /** Pre-seeded ledger reads keyed by `${tournamentId}:${userId}`. */
  ledgerByUser: Record<string, CoinTransactionRecord[]>;
  /** Leaderboard fixtures. */
  memberships: MembershipRecord[];
  teams: TeamRecord[];
  users: UserRecord[];
  balances: CoinBalanceRow[];
}

function freshStores(): Stores {
  const games: GameRecord[] = [
    {
      id: "g1",
      matchupId: MID,
      roundNo: 1,
      courtId: "court1",
      homePairId: "pa1",
      awayPairId: "pb1",
      scoreHome: 21,
      scoreAway: 10,
      winnerPairId: "pa1",
      status: "final",
    },
    {
      id: "g2",
      matchupId: MID,
      roundNo: 2,
      courtId: "court1",
      homePairId: "pa1",
      awayPairId: "pb1",
      scoreHome: 15,
      scoreAway: 21,
      winnerPairId: "pb1",
      status: "final",
    },
    // Not final -> ignored.
    {
      id: "g3",
      matchupId: MID,
      roundNo: 3,
      courtId: "court1",
      homePairId: "pa1",
      awayPairId: "pb1",
      scoreHome: null,
      scoreAway: null,
      winnerPairId: null,
      status: "assigned",
    },
  ];

  const lineups: LineupWithPairs[] = [
    {
      id: "l1",
      matchupId: MID,
      teamId: "teamA",
      roundNo: 1,
      submittedBy: "a1",
      locked: true,
      lockedAt: new Date(),
      pairs: [
        { id: "pa1", lineupId: "l1", slot: 1, playerIds: ["a1", "a2"] },
        { id: "pb1", lineupId: "l1", slot: 1, playerIds: ["b1", "b2"] },
      ],
    },
  ];

  const matchups: MatchupRecord[] = [
    {
      id: MID,
      tournamentId: TID,
      stage: "round_robin",
      roundIndex: 1,
      bracketSlot: null,
      teamAId: TA,
      teamBId: TB,
      status: "final",
      winnerTeamId: TA,
    },
  ];

  return {
    tournament: detail(),
    games,
    lineups,
    matchups,
    createdRows: [],
    createdSingles: [],
    deletedFor: [],
    ledgerByUser: {},
    memberships: [],
    teams: [],
    users: [],
    balances: [],
  };
}

function buildService(stores: Stores): EconomyService {
  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === TID ? stores.tournament : null;
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
    async updateRules(_id, patch) {
      if (patch.coinRule) stores.tournament!.coinRule = patch.coinRule;
      if (patch.streakRule) stores.tournament!.streakRule = patch.streakRule;
      return { ...stores.tournament! };
    },
    async setShopVisible() {
      throw new Error("not used");
    },
    async setPotluckDetails() {
      throw new Error("not used");
    },
  };

  const games: GameRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async findById() {
      throw new Error("not used");
    },
    async listByMatchup() {
      throw new Error("not used");
    },
    async listByTournament() {
      return stores.games.map((g) => ({ ...g }));
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

  const lineups: LineupRepo = {
    async findByRound() {
      return null;
    },
    async listByMatchup(matchupId) {
      return stores.lineups.filter((l) => l.matchupId === matchupId).map((l) => ({ ...l, pairs: [...l.pairs] }));
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

  const matchups: MatchupRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async listByTournament() {
      return stores.matchups.map((m) => ({
        ...m,
        teamAName: "Alpha",
        teamBName: "Bravo",
        games: [],
      }));
    },
    async findById() {
      throw new Error("not used");
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

  const coinLedger: CoinLedgerRepo = {
    async createMany(rows) {
      stores.createdRows.push(rows);
    },
    async create(row) {
      const record: CoinTransactionRecord = {
        id: `adj-${stores.createdSingles.length + 1}`,
        tournamentId: row.tournamentId,
        userId: row.userId,
        delta: row.delta,
        reason: row.reason,
        gameId: row.gameId ?? null,
        bountyId: row.bountyId ?? null,
        missionId: row.missionId ?? null,
        purchaseId: row.purchaseId ?? null,
        note: row.note ?? null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      };
      stores.createdSingles.push(record);
      // Reflect the insert in subsequent balance/history reads.
      const key = `${row.tournamentId}:${row.userId}`;
      stores.ledgerByUser[key] = [record, ...(stores.ledgerByUser[key] ?? [])];
      return record;
    },
    async deleteDerivedByTournament(tournamentId) {
      stores.deletedFor.push(tournamentId);
    },
    async sumByUser(tournamentId, userId) {
      const rows = stores.ledgerByUser[`${tournamentId}:${userId}`] ?? [];
      return rows.reduce((sum, r) => sum + r.delta, 0);
    },
    async listByUser(tournamentId, userId) {
      return (stores.ledgerByUser[`${tournamentId}:${userId}`] ?? []).map((r) => ({ ...r }));
    },
    async sumByTournamentGroupedByUser() {
      return stores.balances.map((b) => ({ ...b }));
    },
  };

  const memberships = {
    async findByUserAndTournament(userId: string, tournamentId: string) {
      return (
        stores.memberships.find((m) => m.userId === userId && m.tournamentId === tournamentId) ?? null
      );
    },
    async listByUser() {
      return [];
    },
    async listByTeam() {
      return [];
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
    async setPassword() {
      throw new Error("not used");
    },
  } satisfies UserRepo;

  const teams = {
    async create() {
      throw new Error("not used");
    },
    async findById() {
      return null;
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

  return makeEconomyService({
    tournaments,
    games,
    lineups,
    matchups,
    memberships,
    users,
    teams,
    coinLedger,
    uow: passthroughUow,
  });
}

describe("economyService.recomputeTournamentLedger", () => {
  let stores: Stores;
  let service: EconomyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("writes match_result rows for finalized games only", async () => {
    await service.recomputeTournamentLedger(TID);

    expect(stores.deletedFor).toEqual([TID]);
    expect(stores.createdRows).toHaveLength(1);
    const rows = stores.createdRows[0]!;
    const matchResultRows = rows.filter((r) => r.reason === "match_result");

    // g1: a1/a2 win 21-10, g2: a1/a2 lose 15-21 (close, margin 6 > 3 -> not close by default rule).
    const byGameAndUser = new Map(matchResultRows.map((r) => [`${r.gameId}:${r.userId}`, r.delta]));
    expect(byGameAndUser.get("g1:a1")).toBe(DEFAULT_COIN_RULE.perWin);
    expect(byGameAndUser.get("g1:a2")).toBe(DEFAULT_COIN_RULE.perWin);
    expect(byGameAndUser.get("g1:b1")).toBe(DEFAULT_COIN_RULE.perLoss);
    expect(byGameAndUser.get("g2:b1")).toBe(DEFAULT_COIN_RULE.perWin);

    // Every row is stamped with the tournament id and reason.
    expect(rows.every((r) => r.tournamentId === TID)).toBe(true);
    expect(matchResultRows.every((r) => r.reason === "match_result")).toBe(true);

    // g3 (not final) contributes no rows.
    expect(matchResultRows.some((r) => r.gameId === "g3")).toBe(false);

    // Single decided matchup, team A won it: no player has a run long enough
    // for a streak bonus yet (first tier is after 2 consecutive matchups).
    expect(rows.some((r) => r.reason === "streak_bonus")).toBe(false);
  });

  it("recompute is idempotent: a second call deletes before it re-inserts", async () => {
    await service.recomputeTournamentLedger(TID);
    await service.recomputeTournamentLedger(TID);

    expect(stores.deletedFor).toEqual([TID, TID]);
    expect(stores.createdRows).toHaveLength(2);
    expect(stores.createdRows[0]).toEqual(stores.createdRows[1]);
  });

  it("does nothing when the tournament does not exist", async () => {
    stores.tournament = null;
    await service.recomputeTournamentLedger(TID);
    expect(stores.deletedFor).toHaveLength(0);
    expect(stores.createdRows).toHaveLength(0);
  });

  it("awards streak_bonus rows to a team on a multi-matchup losing run (playoffs included)", async () => {
    // Extend to three decided matchups: team B (b1/b2) loses matchup 1 and 2
    // (round robin), then also loses the semifinal — a 3-matchup losing run
    // should award the tier-2 (25) and tier-3 (50) bonuses in order.
    const m2: MatchupRecord = {
      id: "m2",
      tournamentId: TID,
      stage: "round_robin",
      roundIndex: 2,
      bracketSlot: null,
      teamAId: TA,
      teamBId: TB,
      status: "final",
      winnerTeamId: TA,
    };
    const m3: MatchupRecord = {
      id: "m3",
      tournamentId: TID,
      stage: "semifinal",
      roundIndex: 1,
      bracketSlot: null,
      teamAId: TA,
      teamBId: TB,
      status: "final",
      winnerTeamId: TA,
    };
    stores.matchups.push(m2, m3);

    const lineupFor = (matchupId: string, roundNo: number): LineupWithPairs[] => [
      {
        id: `${matchupId}-lA`,
        matchupId,
        teamId: TA,
        roundNo,
        submittedBy: "a1",
        locked: true,
        lockedAt: new Date(),
        pairs: [{ id: `${matchupId}-pa`, lineupId: `${matchupId}-lA`, slot: 1, playerIds: ["a1", "a2"] }],
      },
      {
        id: `${matchupId}-lB`,
        matchupId,
        teamId: TB,
        roundNo,
        submittedBy: "b1",
        locked: true,
        lockedAt: new Date(),
        pairs: [{ id: `${matchupId}-pb`, lineupId: `${matchupId}-lB`, slot: 1, playerIds: ["b1", "b2"] }],
      },
    ];

    // Replace matchup 1's lineups too, so both teams have full participant lists.
    stores.lineups = [...lineupFor(MID, 1), ...lineupFor("m2", 1), ...lineupFor("m3", 1)];

    // No games needed on m2/m3 for the streak computation (it reads matchup
    // status/winner directly) — clear games so match_result rows stay scoped
    // to the original g1/g2 fixture.
    await service.recomputeTournamentLedger(TID);

    const rows = stores.createdRows[0]!;
    const streakRows = rows.filter((r) => r.reason === "streak_bonus" && r.userId === "b1");
    expect(streakRows.map((r) => r.delta)).toEqual([25, 50]);
    expect(streakRows.every((r) => r.gameId === null)).toBe(true);
    expect(streakRows.every((r) => typeof r.note === "string" && r.note!.includes("Loss streak"))).toBe(true);

    // b2 (same team, same run) gets an identical pair of bonuses.
    const b2Rows = rows.filter((r) => r.reason === "streak_bonus" && r.userId === "b2");
    expect(b2Rows.map((r) => r.delta)).toEqual([25, 50]);

    // The winning team never had a losing run -> no streak bonuses for them.
    expect(rows.some((r) => r.reason === "streak_bonus" && (r.userId === "a1" || r.userId === "a2"))).toBe(false);
  });
});

describe("economyService.getCoinSummary", () => {
  let stores: Stores;
  let service: EconomyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  function txn(over: Partial<CoinTransactionRecord>): CoinTransactionRecord {
    return {
      id: "tx1",
      tournamentId: TID,
      userId: "a1",
      delta: 100,
      reason: "match_result",
      gameId: null,
      bountyId: null,
      missionId: null,
      purchaseId: null,
      note: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...over,
    };
  }

  it("returns a zero balance and no transactions for a player with no ledger entries", async () => {
    const summary = await service.getCoinSummary(TID, "nobody");
    expect(summary).toEqual({ balance: 0, transactions: [] });
  });

  it("sums the balance and maps rows to the client shape (createdAt as ISO)", async () => {
    stores.ledgerByUser[`${TID}:a1`] = [
      txn({ id: "tx2", delta: 25, reason: "streak_bonus", note: "Loss streak x2", createdAt: new Date("2026-01-02T00:00:00.000Z") }),
      txn({ id: "tx1", delta: 100, reason: "match_result", gameId: "g1" }),
    ];

    const summary = await service.getCoinSummary(TID, "a1");

    expect(summary.balance).toBe(125);
    // Non-match rows carry a null match; the match_result row is enriched below.
    const streak = summary.transactions.find((t) => t.id === "tx2")!;
    expect(streak).toEqual({
      id: "tx2",
      delta: 25,
      reason: "streak_bonus",
      note: "Loss streak x2",
      gameId: null,
      createdAt: "2026-01-02T00:00:00.000Z",
      match: null,
    });
  });

  it("enriches a match_result row with the game/matchup, oriented to the player", async () => {
    // g1 in the fixture: a1/a2 (home pair pa1) beat b1/b2 21–10 in round robin round 1.
    stores.ledgerByUser[`${TID}:a1`] = [txn({ id: "tx1", delta: 100, reason: "match_result", gameId: "g1" })];

    const [tx] = (await service.getCoinSummary(TID, "a1")).transactions;
    expect(tx!.match).toEqual({
      matchupId: MID,
      stage: "round_robin",
      roundIndex: 1,
      roundNo: 1,
      opponentTeamName: "Bravo",
      scoreFor: 21,
      scoreAgainst: 10,
      won: true,
    });
  });

  it("orients the score from the losing player's side", async () => {
    // Same g1, but from b1's perspective (away pair pb1): lost 10–21 vs Alpha.
    stores.ledgerByUser[`${TID}:b1`] = [txn({ id: "tx3", userId: "b1", delta: 50, reason: "match_result", gameId: "g1" })];

    const [tx] = (await service.getCoinSummary(TID, "b1")).transactions;
    expect(tx!.match).toMatchObject({
      opponentTeamName: "Alpha",
      scoreFor: 10,
      scoreAgainst: 21,
      won: false,
    });
  });

  it("leaves match null when the player's side can't be resolved", async () => {
    // A match_result row for a user who is on neither pair of the game.
    stores.ledgerByUser[`${TID}:ghost`] = [txn({ id: "tx4", userId: "ghost", delta: 50, reason: "match_result", gameId: "g1" })];

    const [tx] = (await service.getCoinSummary(TID, "ghost")).transactions;
    expect(tx!.match).toBeNull();
  });

  it("scopes the balance to the tournament (no carry-over across tournaments)", async () => {
    stores.ledgerByUser[`${TID}:a1`] = [txn({ delta: 100 })];
    stores.ledgerByUser[`other:a1`] = [txn({ tournamentId: "other", delta: 999 })];

    const summary = await service.getCoinSummary(TID, "a1");
    expect(summary.balance).toBe(100);
  });
});

describe("economyService.getLeaderboard", () => {
  let stores: Stores;
  let service: EconomyService;

  function member(userId: string, teamId: string): MembershipRecord {
    return { id: `m-${userId}`, userId, teamId, tournamentId: TID, role: "member", createdAt: new Date() };
  }
  function userRec(id: string, displayName: string): UserRecord {
    return { id, username: id, displayName, passwordHash: "x", isAdmin: false, createdAt: new Date() };
  }

  beforeEach(() => {
    stores = freshStores();
    stores.teams = [
      { id: TA, tournamentId: TID, name: "Alpha", createdAt: new Date() },
      { id: TB, tournamentId: TID, name: "Bravo", createdAt: new Date() },
    ];
    stores.memberships = [member("a1", TA), member("a2", TA), member("b1", TB)];
    stores.users = [userRec("a1", "Ann"), userRec("a2", "Abe"), userRec("b1", "Bo")];
    service = buildService(stores);
  });

  it("ranks every member by balance and joins name + team", async () => {
    stores.balances = [
      { userId: "a1", balance: 100 },
      { userId: "b1", balance: 250 },
      // a2 has no ledger rows -> not in balances -> should default to 0.
    ];

    const { rows } = await service.getLeaderboard(TID);

    expect(rows.map((r) => [r.displayName, r.teamName, r.balance, r.rank])).toEqual([
      ["Bo", "Bravo", 250, 1],
      ["Ann", "Alpha", 100, 2],
      ["Abe", "Alpha", 0, 3],
    ]);
  });

  it("includes members with no coins at a zero balance (start-at-0 per tournament)", async () => {
    stores.balances = []; // nobody has earned yet
    const { rows } = await service.getLeaderboard(TID);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.balance === 0)).toBe(true);
    // All tied at 0 -> all rank 1.
    expect(rows.every((r) => r.rank === 1)).toBe(true);
  });
});

describe("economyService.adjustCoins", () => {
  let stores: Stores;
  let service: EconomyService;

  function member(userId: string, teamId: string): MembershipRecord {
    return { id: `m-${userId}`, userId, teamId, tournamentId: TID, role: "member", createdAt: new Date() };
  }

  beforeEach(() => {
    stores = freshStores();
    stores.memberships = [member("a1", TA)];
    service = buildService(stores);
  });

  it("writes an auditable admin_adjust row and returns the new balance", async () => {
    stores.ledgerByUser[`${TID}:a1`] = []; // starts at 0

    const result = await service.adjustCoins({ tournamentId: TID, userId: "a1", delta: 50, note: " bonus " });

    expect(stores.createdSingles).toHaveLength(1);
    const row = stores.createdSingles[0]!;
    expect(row).toMatchObject({ tournamentId: TID, userId: "a1", delta: 50, reason: "admin_adjust", note: "bonus", gameId: null });
    expect(result.balance).toBe(50);
    expect(result.transaction).toMatchObject({ delta: 50, reason: "admin_adjust", note: "bonus", match: null });
    expect(result.transaction.createdAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("supports negative deltas (reversals) and sums against existing rows", async () => {
    stores.ledgerByUser[`${TID}:a1`] = [
      {
        id: "seed",
        tournamentId: TID,
        userId: "a1",
        delta: 100,
        reason: "match_result",
        gameId: null,
        bountyId: null,
        missionId: null,
        purchaseId: null,
        note: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    const result = await service.adjustCoins({ tournamentId: TID, userId: "a1", delta: -30 });
    expect(result.balance).toBe(70);
    expect(stores.createdSingles[0]!.note).toBeNull();
  });

  it("rejects a zero or non-integer delta without writing a row", async () => {
    await expect(service.adjustCoins({ tournamentId: TID, userId: "a1", delta: 0 })).rejects.toThrow();
    await expect(service.adjustCoins({ tournamentId: TID, userId: "a1", delta: 1.5 })).rejects.toThrow();
    expect(stores.createdSingles).toHaveLength(0);
  });

  it("rejects a delta beyond the max magnitude (no int overflow reaches the DB)", async () => {
    await expect(
      service.adjustCoins({ tournamentId: TID, userId: "a1", delta: 5_000_000_000 }),
    ).rejects.toThrow(/between/);
    await expect(
      service.adjustCoins({ tournamentId: TID, userId: "a1", delta: -5_000_000_000 }),
    ).rejects.toThrow(/between/);
    expect(stores.createdSingles).toHaveLength(0);
  });

  it("rejects adjusting a player who is not a member of the tournament", async () => {
    await expect(service.adjustCoins({ tournamentId: TID, userId: "stranger", delta: 10 })).rejects.toThrow();
    expect(stores.createdSingles).toHaveLength(0);
  });

  it("does not use the derived-row delete path (adjustments survive recompute)", async () => {
    await service.adjustCoins({ tournamentId: TID, userId: "a1", delta: 10 });
    expect(stores.deletedFor).toHaveLength(0);
  });
});

describe("economyService.resetCoins", () => {
  let stores: Stores;
  let service: EconomyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("writes a reversing admin_adjust row for every non-zero balance", async () => {
    stores.balances = [
      { userId: "a1", balance: 120 },
      { userId: "a2", balance: 0 }, // already zero -> skipped
      { userId: "b1", balance: -30 },
    ];

    const result = await service.resetCoins(TID, "  Fresh event  ");

    expect(result).toEqual({ playersReset: 2, coinsReversed: 90 });
    const rows = stores.createdRows[0]!;
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    expect(byUser.get("a1")).toMatchObject({ delta: -120, reason: "admin_adjust", note: "Fresh event" });
    expect(byUser.get("b1")).toMatchObject({ delta: 30, reason: "admin_adjust", note: "Fresh event" });
    expect(byUser.has("a2")).toBe(false);
    // Reset never deletes — it only appends reversing rows.
    expect(stores.deletedFor).toHaveLength(0);
  });

  it("does nothing when every balance is already zero", async () => {
    stores.balances = [{ userId: "a1", balance: 0 }];
    const result = await service.resetCoins(TID);
    expect(result).toEqual({ playersReset: 0, coinsReversed: 0 });
    expect(stores.createdRows).toHaveLength(0);
  });
});

describe("economyService.getRules / updateRules", () => {
  let stores: Stores;
  let service: EconomyService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("returns the tournament's current rules", async () => {
    const rules = await service.getRules(TID);
    expect(rules.coinRule).toEqual(DEFAULT_COIN_RULE);
    expect(rules.streakRule).toEqual(DEFAULT_STREAK_RULE);
  });

  it("persists new rules and recomputes derived coins with them", async () => {
    const coinRule = { perWin: 10, perLoss: 1 };
    const result = await service.updateRules(TID, { coinRule });

    expect(result.coinRule).toEqual(coinRule);
    expect(stores.tournament!.coinRule).toEqual(coinRule);
    // Recompute ran and used the new perWin (g1: a1/a2 win).
    expect(stores.deletedFor).toContain(TID);
    const rows = stores.createdRows.at(-1)!;
    expect(rows.find((r) => r.gameId === "g1" && r.userId === "a1")!.delta).toBe(10);
  });

  it("rejects an empty patch", async () => {
    await expect(service.updateRules(TID, {})).rejects.toThrow();
  });
});
