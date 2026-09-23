import { beforeEach, describe, expect, it } from "vitest";
import { makeShopService, type ShopService } from "../../src/services/shopService.js";
import type {
  CoinLedgerRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRepo,
  MatchupView,
  MembershipRecord,
  MembershipRepo,
  NewCoinTransaction,
  NewPowerup,
  NewPurchase,
  PowerupRecord,
  PowerupRepo,
  PublicUser,
  PurchaseRecord,
  PurchaseRepo,
  TournamentRepo,
  UnitOfWork,
} from "../../src/ports/index.js";

const TID = "t1";
const UID = "u1";
const MATE = "u2";
const OPPONENT = "u3";
const TEAM_A = "teamA";
const TEAM_B = "teamB";
const passthroughUow: UnitOfWork = { run: (work) => work() };

function user(id: string, isAdmin = false): PublicUser {
  return { id, username: id, displayName: id, isAdmin, createdAt: new Date() };
}

interface Stores {
  powerups: PowerupRecord[];
  purchases: PurchaseRecord[];
  ledgerRows: NewCoinTransaction[];
  balance: number;
  memberships: MembershipRecord[];
  games: GameRecord[];
  matchups: MatchupView[];
  lineups: LineupWithPairs[];
  shopVisible: boolean;
  seq: number;
}

function freshStores(balance = 100): Stores {
  return {
    powerups: [],
    purchases: [],
    ledgerRows: [],
    balance,
    memberships: [],
    games: [],
    matchups: [],
    lineups: [],
    shopVisible: true,
    seq: 0,
  };
}

/** Sets up a team-A-vs-team-B matchup with one assigned (unscored) game for UID + MATE (team A) vs OPPONENT (team B). */
function seedCurrentGame(stores: Stores, gameOverrides: Partial<GameRecord> = {}): GameRecord {
  stores.memberships.push(
    { id: "mA", userId: UID, teamId: TEAM_A, tournamentId: TID, role: "member", createdAt: new Date() },
    { id: "mB", userId: MATE, teamId: TEAM_A, tournamentId: TID, role: "member", createdAt: new Date() },
    { id: "mC", userId: OPPONENT, teamId: TEAM_B, tournamentId: TID, role: "member", createdAt: new Date() },
  );
  stores.matchups.push({
    id: "m1",
    tournamentId: TID,
    stage: "round_robin",
    roundIndex: 1,
    bracketSlot: null,
    teamAId: TEAM_A,
    teamBId: TEAM_B,
    status: "in_progress",
    winnerTeamId: null,
    teamAName: "Alpha",
    teamBName: "Bravo",
    games: [],
  });
  stores.lineups.push({
    id: "l1",
    matchupId: "m1",
    teamId: TEAM_A,
    roundNo: 1,
    submittedBy: UID,
    locked: true,
    lockedAt: new Date(),
    pairs: [{ id: "pairA", lineupId: "l1", slot: 1, playerIds: [UID, MATE] }],
  });
  stores.lineups.push({
    id: "l2",
    matchupId: "m1",
    teamId: TEAM_B,
    roundNo: 1,
    submittedBy: OPPONENT,
    locked: true,
    lockedAt: new Date(),
    pairs: [{ id: "pairB", lineupId: "l2", slot: 1, playerIds: [OPPONENT] }],
  });
  const game: GameRecord = {
    id: "g1",
    matchupId: "m1",
    roundNo: 1,
    courtId: null,
    homePairId: "pairA",
    awayPairId: "pairB",
    scoreHome: null,
    scoreAway: null,
    winnerPairId: null,
    status: "assigned",
    teamAPowerupUsedBy: null,
    teamBPowerupUsedBy: null,
    ...gameOverrides,
  };
  stores.games.push(game);
  return game;
}

function buildService(stores: Stores): ShopService {
  const powerups: PowerupRepo = {
    async create(p: NewPowerup) {
      const rec: PowerupRecord = {
        id: `p${++stores.seq}`,
        tournamentId: p.tournamentId,
        name: p.name,
        description: p.description,
        cost: p.cost,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      stores.powerups.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const p = stores.powerups.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async listByTournament(tournamentId) {
      return stores.powerups.filter((p) => p.tournamentId === tournamentId).map((p) => ({ ...p }));
    },
    async update() {
      throw new Error("not used");
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const purchases: PurchaseRepo = {
    async create(p: NewPurchase) {
      const rec: PurchaseRecord = {
        id: `pu${++stores.seq}`,
        tournamentId: p.tournamentId,
        userId: p.userId,
        powerupId: p.powerupId,
        costPaid: p.costPaid,
        createdAt: new Date(`2026-02-0${stores.seq}T00:00:00.000Z`),
      };
      stores.purchases.push(rec);
      return { ...rec };
    },
    async findById(id) {
      const p = stores.purchases.find((x) => x.id === id);
      return p ? { ...p } : null;
    },
    async listByUser(tournamentId, userId) {
      return stores.purchases
        .filter((p) => p.tournamentId === tournamentId && p.userId === userId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((p) => ({ ...p }));
    },
    async findByUserAndPowerup(userId, powerupId) {
      const p = stores.purchases.find((x) => x.userId === userId && x.powerupId === powerupId);
      return p ? { ...p } : null;
    },
    async delete(id) {
      stores.purchases = stores.purchases.filter((x) => x.id !== id);
    },
  };

  const coinLedger = {
    async createMany() {
      throw new Error("not used");
    },
    async create(row: NewCoinTransaction) {
      stores.ledgerRows.push(row);
      stores.balance += row.delta;
      return { id: `c${++stores.seq}`, createdAt: new Date(), gameId: null, bountyId: null, missionId: null, ...row } as never;
    },
    async deleteDerivedByTournament() {},
    async sumByUser() {
      return stores.balance;
    },
    async listByUser() {
      return [];
    },
    async sumByTournamentGroupedByUser() {
      return [];
    },
  } satisfies CoinLedgerRepo;

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
      // every seeded matchup here belongs to TID
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
      throw new Error("not used");
    },
    async deleteByTournament() {
      throw new Error("not used");
    },
    async claimPowerupSlot(gameId, team, userId) {
      const g = stores.games.find((x) => x.id === gameId);
      if (!g) return false;
      const field = team === "A" ? "teamAPowerupUsedBy" : "teamBPowerupUsedBy";
      if (g[field] !== null) return false;
      g[field] = userId;
      return true;
    },
  };

  const matchups: MatchupRepo = {
    async createMany() {
      throw new Error("not used");
    },
    async listByTournament() {
      return stores.matchups.map((m) => ({ ...m }));
    },
    async findById(id) {
      return stores.matchups.find((m) => m.id === id) ?? null;
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

  const lineups: LineupRepo = {
    async findByRound() {
      throw new Error("not used");
    },
    async listByMatchup() {
      throw new Error("not used");
    },
    async listByTeam(teamId) {
      return stores.lineups.filter((l) => l.teamId === teamId).map((l) => ({ ...l, pairs: l.pairs.map((p) => ({ ...p })) }));
    },
    async findById() {
      throw new Error("not used");
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

  const tournaments: TournamentRepo = {
    async getDetail(id) {
      if (id !== TID) return null;
      return {
        id: TID,
        name: "Test",
        status: "round_robin",
        teamCount: 2,
        teamSize: 2,
        pairSize: 2,
        pairsPerLineup: 1,
        roundsPerMatchup: 1,
        roundRobinCycles: 1,
        playoffQualifiers: 2,
        courtCount: 1,
        coinRule: {} as never,
        streakRule: {} as never,
        shopVisible: stores.shopVisible,
      };
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
    async updateRules() {
      throw new Error("not used");
    },
    async setShopVisible() {
      throw new Error("not used");
    },
  };

  return makeShopService({ powerups, purchases, coinLedger, memberships, games, matchups, lineups, tournaments, uow: passthroughUow });
}

function seedPowerup(stores: Stores, cost: number, name = "Extra Serve"): PowerupRecord {
  const p: PowerupRecord = {
    id: `p${++stores.seq}`,
    tournamentId: TID,
    name,
    description: "desc",
    cost,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  stores.powerups.push(p);
  return p;
}

describe("shopService.listForUser", () => {
  it("marks owned powerups", async () => {
    const stores = freshStores();
    const p1 = seedPowerup(stores, 10, "A");
    const p2 = seedPowerup(stores, 20, "B");
    stores.purchases.push({ id: "pu1", tournamentId: TID, userId: UID, powerupId: p1.id, costPaid: 10, createdAt: new Date() });

    const service = buildService(stores);
    const list = await service.listForUser(TID, user(UID));
    expect(list.find((x) => x.id === p1.id)?.owned).toBe(true);
    expect(list.find((x) => x.id === p2.id)?.owned).toBe(false);
  });
});

describe("shopService visibility gate", () => {
  it("blocks a non-admin when the tournament's shop is hidden", async () => {
    const stores = freshStores();
    stores.shopVisible = false;
    const p = seedPowerup(stores, 10);
    const service = buildService(stores);

    await expect(service.listForUser(TID, user(UID))).rejects.toThrow(/shop/i);
    await expect(service.listInventory(TID, user(UID))).rejects.toThrow(/shop/i);
    await expect(service.purchase(TID, user(UID), p.id)).rejects.toThrow(/shop/i);
  });

  it("lets an admin through even when the shop is hidden", async () => {
    const stores = freshStores();
    stores.shopVisible = false;
    seedPowerup(stores, 10);
    const service = buildService(stores);

    await expect(service.listForUser(TID, user("admin1", true))).resolves.toBeDefined();
  });
});

describe("shopService.purchase", () => {
  let stores: Stores;
  let service: ShopService;

  beforeEach(() => {
    stores = freshStores(100);
    service = buildService(stores);
  });

  it("buys a powerup, debits coins and records the purchase", async () => {
    const p = seedPowerup(stores, 30);
    const result = await service.purchase(TID, user(UID), p.id);

    expect(result.balance).toBe(70);
    expect(result.purchase).toMatchObject({ powerupId: p.id, name: p.name, cost: 30 });
    expect(stores.ledgerRows).toEqual([
      { tournamentId: TID, userId: UID, delta: -30, reason: "purchase", purchaseId: result.purchase.id, note: p.name },
    ]);
  });

  it("refuses to buy the same powerup twice", async () => {
    const p = seedPowerup(stores, 10);
    await service.purchase(TID, user(UID), p.id);
    await expect(service.purchase(TID, user(UID), p.id)).rejects.toThrow(/already own/i);
  });

  it("refuses a purchase without enough coins", async () => {
    const p = seedPowerup(stores, 500);
    await expect(service.purchase(TID, user(UID), p.id)).rejects.toThrow(/not enough coins/i);
    expect(stores.purchases).toHaveLength(0);
  });

  it("404s an unknown powerup or one from another tournament", async () => {
    await expect(service.purchase(TID, user(UID), "nope")).rejects.toThrow();
    const p = seedPowerup(stores, 10);
    await expect(service.purchase("otherTournament", user(UID), p.id)).rejects.toThrow();
  });
});

describe("shopService.listInventory", () => {
  it("returns owned powerups with purchase price and date", async () => {
    const stores = freshStores(100);
    const p = seedPowerup(stores, 40, "Shield");
    const service = buildService(stores);
    await service.purchase(TID, user(UID), p.id);

    const inventory = await service.listInventory(TID, user(UID));
    expect(inventory).toHaveLength(1);
    expect(inventory[0]).toMatchObject({ powerupId: p.id, name: "Shield", cost: 40 });
  });
});

describe("shopService.use", () => {
  let stores: Stores;
  let service: ShopService;

  beforeEach(() => {
    stores = freshStores(100);
    service = buildService(stores);
  });

  it("uses a powerup, claims the team's slot on the current game, and consumes the purchase", async () => {
    const game = seedCurrentGame(stores);
    const p = seedPowerup(stores, 10, "Extra Serve");
    const bought = await service.purchase(TID, user(UID), p.id);

    const result = await service.use(TID, user(UID), bought.purchase.id);

    expect(result).toMatchObject({ powerupId: p.id, name: "Extra Serve", gameId: game.id });
    expect(stores.purchases).toHaveLength(0); // consumed
    expect(stores.games.find((g) => g.id === game.id)?.teamAPowerupUsedBy).toBe(UID);
  });

  it("frees the slot to rebuy the same powerup after use", async () => {
    seedCurrentGame(stores);
    const p = seedPowerup(stores, 10);
    const bought = await service.purchase(TID, user(UID), p.id);
    await service.use(TID, user(UID), bought.purchase.id);

    await expect(service.purchase(TID, user(UID), p.id)).resolves.toMatchObject({ purchase: { powerupId: p.id } });
  });

  it("refuses a second teammate from using a powerup in the same game", async () => {
    seedCurrentGame(stores);
    const p1 = seedPowerup(stores, 10, "A");
    const p2 = seedPowerup(stores, 10, "B");
    const bought1 = await service.purchase(TID, user(UID), p1.id);
    await service.use(TID, user(UID), bought1.purchase.id);

    const bought2 = await service.purchase(TID, user(MATE), p2.id);
    await expect(service.use(TID, user(MATE), bought2.purchase.id)).rejects.toThrow(/already used/i);
    // The teammate's purchase is untouched since the use failed.
    expect(stores.purchases.some((x) => x.id === bought2.purchase.id)).toBe(true);
  });

  it("does not block the opposing team's slot", async () => {
    seedCurrentGame(stores);
    const p1 = seedPowerup(stores, 10, "A");
    const p2 = seedPowerup(stores, 10, "B");
    const bought1 = await service.purchase(TID, user(UID), p1.id);
    await service.use(TID, user(UID), bought1.purchase.id);

    const bought2 = await service.purchase(TID, user(OPPONENT), p2.id);
    await expect(service.use(TID, user(OPPONENT), bought2.purchase.id)).resolves.toMatchObject({ powerupId: p2.id });
  });

  it("refuses to use a powerup with no game currently in progress", async () => {
    const p = seedPowerup(stores, 10);
    stores.memberships.push({ id: "mA", userId: UID, teamId: TEAM_A, tournamentId: TID, role: "member", createdAt: new Date() });
    const bought = await service.purchase(TID, user(UID), p.id);
    await expect(service.use(TID, user(UID), bought.purchase.id)).rejects.toThrow(/game in progress/i);
  });

  it("404s a purchase that isn't the caller's own", async () => {
    seedCurrentGame(stores);
    const p = seedPowerup(stores, 10);
    const bought = await service.purchase(TID, user(UID), p.id);
    await expect(service.use(TID, user(OPPONENT), bought.purchase.id)).rejects.toThrow();
  });
});
