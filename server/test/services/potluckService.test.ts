import { beforeEach, describe, expect, it } from "vitest";
import { makePotluckService, type PotluckService } from "../../src/services/potluckService.js";
import type {
  PotluckRsvpRecord,
  PotluckRsvpRepo,
  TournamentDetail,
  TournamentRepo,
  UpsertPotluckRsvp,
  UserRecord,
  UserRepo,
} from "../../src/ports/index.js";

const TID = "t1";
const UID = "u1";

interface Stores {
  tournament: TournamentDetail;
  rsvps: PotluckRsvpRecord[];
  users: UserRecord[];
  seq: number;
}

function baseTournament(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
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
    shopVisible: true,
    potluckEventAt: null,
    potluckAddress: null,
    ...overrides,
  };
}

function userRec(id: string, displayName: string): UserRecord {
  return { id, username: id, displayName, passwordHash: "x", isAdmin: false, createdAt: new Date() };
}

function freshStores(): Stores {
  return {
    tournament: baseTournament(),
    rsvps: [],
    users: [userRec(UID, "Ann"), userRec("u2", "Bob")],
    seq: 0,
  };
}

function buildService(stores: Stores): PotluckService {
  const rsvps: PotluckRsvpRepo = {
    async findByUser(tournamentId, userId) {
      return stores.rsvps.find((r) => r.tournamentId === tournamentId && r.userId === userId) ?? null;
    },
    async listByTournament(tournamentId) {
      return stores.rsvps.filter((r) => r.tournamentId === tournamentId).map((r) => ({ ...r }));
    },
    async upsert(input: UpsertPotluckRsvp) {
      const existing = stores.rsvps.find(
        (r) => r.tournamentId === input.tournamentId && r.userId === input.userId,
      );
      if (existing) {
        existing.attending = input.attending;
        existing.item = input.item;
        existing.updatedAt = new Date();
        return { ...existing };
      }
      const rec: PotluckRsvpRecord = {
        id: `r${++stores.seq}`,
        tournamentId: input.tournamentId,
        userId: input.userId,
        attending: input.attending,
        item: input.item,
        updatedAt: new Date(),
      };
      stores.rsvps.push(rec);
      return { ...rec };
    },
  };

  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === stores.tournament.id ? { ...stores.tournament } : null;
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
    async setPotluckDetails(_id, patch) {
      stores.tournament.potluckEventAt = patch.eventAt;
      stores.tournament.potluckAddress = patch.address;
      return { ...stores.tournament };
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

  return makePotluckService({ rsvps, tournaments, users });
}

describe("potluckService.get", () => {
  it("shows null settings until the admin sets them", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    const view = await service.get(TID, UID);
    expect(view.settings).toEqual({ eventAt: null, address: null });
    expect(view.myRsvp).toBeNull();
    expect(view.attendees).toEqual([]);
  });

  it("reflects the event details once set", async () => {
    const stores = freshStores();
    stores.tournament.potluckEventAt = new Date("2026-11-28T23:00:00.000Z");
    stores.tournament.potluckAddress = "123 Main St";
    const service = buildService(stores);
    const view = await service.get(TID, UID);
    expect(view.settings).toEqual({ eventAt: "2026-11-28T23:00:00.000Z", address: "123 Main St" });
  });

  it("lists only attendees, alphabetically, with what they're bringing", async () => {
    const stores = freshStores();
    stores.rsvps.push(
      { id: "r1", tournamentId: TID, userId: "u2", attending: true, item: "Chips", updatedAt: new Date() },
      { id: "r2", tournamentId: TID, userId: UID, attending: true, item: "Salad", updatedAt: new Date() },
      { id: "r3", tournamentId: TID, userId: "u3", attending: false, item: null, updatedAt: new Date() },
    );
    const service = buildService(stores);
    const view = await service.get(TID, UID);
    expect(view.attendees).toEqual([
      { displayName: "Ann", item: "Salad" },
      { displayName: "Bob", item: "Chips" },
    ]);
  });

  it("returns the caller's own RSVP", async () => {
    const stores = freshStores();
    stores.rsvps.push({ id: "r1", tournamentId: TID, userId: UID, attending: false, item: null, updatedAt: new Date() });
    const service = buildService(stores);
    const view = await service.get(TID, UID);
    expect(view.myRsvp).toEqual({ attending: false, item: null });
  });
});

describe("potluckService.setRsvp", () => {
  let stores: Stores;
  let service: PotluckService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("saves an attending RSVP with an item", async () => {
    const result = await service.setRsvp(TID, UID, { attending: true, item: "  Cookies  " });
    expect(result).toEqual({ attending: true, item: "Cookies" });
    expect(stores.rsvps).toHaveLength(1);
  });

  it("requires an item when attending", async () => {
    await expect(service.setRsvp(TID, UID, { attending: true })).rejects.toThrow(/bringing/i);
    await expect(service.setRsvp(TID, UID, { attending: true, item: "   " })).rejects.toThrow(/bringing/i);
    expect(stores.rsvps).toHaveLength(0);
  });

  it("clears the item when declining", async () => {
    await service.setRsvp(TID, UID, { attending: true, item: "Cookies" });
    const result = await service.setRsvp(TID, UID, { attending: false });
    expect(result).toEqual({ attending: false, item: null });
  });

  it("upserts — a second call replaces the first answer", async () => {
    await service.setRsvp(TID, UID, { attending: true, item: "Cookies" });
    await service.setRsvp(TID, UID, { attending: true, item: "Brownies" });
    expect(stores.rsvps).toHaveLength(1);
    expect(stores.rsvps[0]!.item).toBe("Brownies");
  });
});
