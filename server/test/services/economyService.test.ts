import { beforeEach, describe, expect, it } from "vitest";
import { makeEconomyService, type EconomyService } from "../../src/services/economyService.js";
import { DEFAULT_COIN_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  CoinLedgerRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  NewCoinTransaction,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
} from "../../src/ports/index.js";

const TID = "t1";
const MID = "m1";
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
  };
}

interface Stores {
  tournament: TournamentDetail | null;
  games: GameRecord[];
  lineups: LineupWithPairs[];
  createdRows: NewCoinTransaction[][];
  deletedFor: string[];
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

  return { tournament: detail(), games, lineups, createdRows: [], deletedFor: [] };
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

  const coinLedger: CoinLedgerRepo = {
    async createMany(rows) {
      stores.createdRows.push(rows);
    },
    async deleteDerivedByTournament(tournamentId) {
      stores.deletedFor.push(tournamentId);
    },
    async sumByUser() {
      return 0;
    },
    async listByUser() {
      return [];
    },
    async sumByTournamentGroupedByUser() {
      return [];
    },
  };

  return makeEconomyService({ tournaments, games, lineups, coinLedger, uow: passthroughUow });
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

    // g1: a1/a2 win 21-10, g2: a1/a2 lose 15-21 (close, margin 6 > 3 -> not close by default rule).
    const byGameAndUser = new Map(rows.map((r) => [`${r.gameId}:${r.userId}`, r.delta]));
    expect(byGameAndUser.get("g1:a1")).toBe(DEFAULT_COIN_RULE.perWin);
    expect(byGameAndUser.get("g1:a2")).toBe(DEFAULT_COIN_RULE.perWin);
    expect(byGameAndUser.get("g1:b1")).toBe(DEFAULT_COIN_RULE.perLoss);
    expect(byGameAndUser.get("g2:b1")).toBe(DEFAULT_COIN_RULE.perWin);

    // Every row is stamped with the tournament id and reason.
    expect(rows.every((r) => r.tournamentId === TID)).toBe(true);
    expect(rows.every((r) => r.reason === "match_result")).toBe(true);

    // g3 (not final) contributes no rows.
    expect(rows.some((r) => r.gameId === "g3")).toBe(false);
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
});
