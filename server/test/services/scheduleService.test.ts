import { beforeEach, describe, expect, it } from "vitest";
import { makeScheduleService, type ScheduleService } from "../../src/services/scheduleService.js";
import { ConflictError, NotFoundError, ValidationError } from "../../src/domain/errors.js";
import { DEFAULT_COIN_RULE, DEFAULT_STREAK_RULE } from "../../src/domain/tournamentDefaults.js";
import type {
  CourtRecord,
  CourtRepo,
  GameRecord,
  GameRepo,
  LineupRepo,
  LineupWithPairs,
  MatchupRecord,
  MatchupRepo,
  SuddenDeathRepo,
  TeamRecord,
  TeamRepo,
  TournamentDetail,
  TournamentRepo,
  UnitOfWork,
} from "../../src/ports/index.js";

const TID = "t1";
const passthroughUow: UnitOfWork = { run: (work) => work() };

interface Stores {
  tournament: TournamentDetail;
  teams: TeamRecord[];
  courts: CourtRecord[];
  matchups: MatchupRecord[];
  games: GameRecord[];
  lineups: LineupWithPairs[];
}

function defaultDetail(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    id: TID,
    name: "Test",
    status: "setup",
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
    ...overrides,
  };
}

function makeTeams(count: number): TeamRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `team${i + 1}`,
    tournamentId: TID,
    name: `Team ${i + 1}`,
    createdAt: new Date(),
  }));
}

function buildService(stores: Stores): ScheduleService {
  let courtSeq = 0;
  let matchupSeq = 0;
  let gameSeq = 0;

  const tournaments: TournamentRepo = {
    async getDetail(id) {
      return id === stores.tournament.id ? { ...stores.tournament } : null;
    },
    async list() {
      const { id, name, status } = stores.tournament;
      return [{ id, name, status }];
    },
    async listByIds(ids) {
      const { id, name, status } = stores.tournament;
      return ids.includes(id) ? [{ id, name, status }] : [];
    },
    async create() {
      throw new Error("not used");
    },
    async setStatus(_id, status) {
      stores.tournament.status = status;
    },
    async updateConfig(_id, patch) {
      Object.assign(stores.tournament, patch);
      return { ...stores.tournament };
    },
  };

  const teams: TeamRepo = {
    async create(tournamentId, name) {
      const rec = { id: `team${stores.teams.length + 1}`, tournamentId, name, createdAt: new Date() };
      stores.teams.push(rec);
      return rec;
    },
    async findById(id) {
      return stores.teams.find((t) => t.id === id) ?? null;
    },
    async findByName(tournamentId, name) {
      return stores.teams.find((t) => t.tournamentId === tournamentId && t.name === name) ?? null;
    },
    async listByTournament(tournamentId) {
      return stores.teams.filter((t) => t.tournamentId === tournamentId);
    },
    async delete(id) {
      stores.teams = stores.teams.filter((t) => t.id !== id);
    },
  };

  const courts: CourtRepo = {
    async listByTournament(tournamentId) {
      return stores.courts.filter((c) => c.tournamentId === tournamentId);
    },
    async findById(id) {
      return stores.courts.find((c) => c.id === id) ?? null;
    },
    async createMany(tournamentId, labels) {
      const created = labels.map((label) => ({ id: `court${++courtSeq}`, tournamentId, label }));
      stores.courts.push(...created);
      return created;
    },
    async rename(id, label) {
      const c = stores.courts.find((x) => x.id === id)!;
      c.label = label;
      return c;
    },
    async deleteByTournament(tournamentId) {
      stores.courts = stores.courts.filter((c) => c.tournamentId !== tournamentId);
    },
  };

  const matchups: MatchupRepo = {
    async createMany(tournamentId, news) {
      return news.map((m) => {
        const rec: MatchupRecord = {
          id: `matchup${++matchupSeq}`,
          tournamentId,
          stage: m.stage,
          roundIndex: m.roundIndex,
          bracketSlot: m.bracketSlot ?? null,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          status: "scheduled",
          winnerTeamId: null,
        };
        stores.matchups.push(rec);
        return rec;
      });
    },
    async listByTournament(tournamentId) {
      const name = (id: string) => stores.teams.find((t) => t.id === id)?.name ?? "?";
      return stores.matchups
        .filter((m) => m.tournamentId === tournamentId)
        .map((m) => ({
          ...m,
          teamAName: name(m.teamAId),
          teamBName: name(m.teamBId),
          games: stores.games
            .filter((g) => g.matchupId === m.id)
            .sort((a, b) => a.roundNo - b.roundNo)
            .map((g) => ({ id: g.id, roundNo: g.roundNo, courtId: g.courtId, status: g.status })),
        }));
    },
    async findById(id) {
      return stores.matchups.find((m) => m.id === id) ?? null;
    },
    async updateTeams(id, teamAId, teamBId) {
      const m = stores.matchups.find((x) => x.id === id)!;
      m.teamAId = teamAId;
      m.teamBId = teamBId;
      return m;
    },
    async setResult(id, result) {
      const m = stores.matchups.find((x) => x.id === id)!;
      m.status = result.status;
      m.winnerTeamId = result.winnerTeamId;
      return m;
    },
    async deleteByTournament(tournamentId) {
      stores.matchups = stores.matchups.filter((m) => m.tournamentId !== tournamentId);
    },
  };

  const matchupTournament = (matchupId: string) =>
    stores.matchups.find((m) => m.id === matchupId)?.tournamentId;

  const games: GameRepo = {
    async createMany(news) {
      for (const g of news) {
        stores.games.push({
          id: `game${++gameSeq}`,
          status: "awaiting_lineups",
          homePairId: null,
          awayPairId: null,
          scoreHome: null,
          scoreAway: null,
          winnerPairId: null,
          ...g,
        });
      }
    },
    async findById(id) {
      return stores.games.find((g) => g.id === id) ?? null;
    },
    async listByMatchup(matchupId) {
      return stores.games.filter((g) => g.matchupId === matchupId);
    },
    async listByTournament(tournamentId) {
      return stores.games.filter((g) => matchupTournament(g.matchupId) === tournamentId);
    },
    async setCourt(id, courtId) {
      const g = stores.games.find((x) => x.id === id)!;
      g.courtId = courtId;
      return g;
    },
    async setScore(id, score) {
      const g = stores.games.find((x) => x.id === id)!;
      g.scoreHome = score.scoreHome;
      g.scoreAway = score.scoreAway;
      g.winnerPairId = score.winnerPairId;
      g.status = "final";
      if (score.courtId) g.courtId = score.courtId;
      return g;
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
    async countByStatus(tournamentId, status) {
      return stores.games.filter(
        (g) => g.status === status && matchupTournament(g.matchupId) === tournamentId,
      ).length;
    },
    async deleteByTournament(tournamentId) {
      stores.games = stores.games.filter((g) => matchupTournament(g.matchupId) !== tournamentId);
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
    async save() {
      throw new Error("not used");
    },
    async setLocked() {
      throw new Error("not used");
    },
    async deleteByTournament(tournamentId) {
      const ids = new Set(
        stores.matchups.filter((m) => m.tournamentId === tournamentId).map((m) => m.id),
      );
      stores.lineups = stores.lineups.filter((l) => !ids.has(l.matchupId));
    },
  };

  const suddenDeath: SuddenDeathRepo = {
    async findByMatchup() {
      return null;
    },
    async create() {
      throw new Error("not used");
    },
    async setRep() {
      throw new Error("not used");
    },
    async setResult() {
      throw new Error("not used");
    },
    async deleteByTournament() {
      /* no sudden-death rows in these tests */
    },
  };

  return makeScheduleService({
    tournaments,
    teams,
    matchups,
    games,
    courts,
    lineups,
    suddenDeath,
    uow: passthroughUow,
  });
}

function freshStores(detail?: Partial<TournamentDetail>, teamCount = 4): Stores {
  const d = defaultDetail(detail);
  return {
    tournament: d,
    teams: makeTeams(teamCount),
    courts: [],
    matchups: [],
    games: [],
    lineups: [],
  };
}

describe("scheduleService.generate", () => {
  let stores: Stores;
  let service: ScheduleService;

  beforeEach(() => {
    stores = freshStores();
    service = buildService(stores);
  });

  it("builds the round-robin, seeds courts, and moves status to round_robin", async () => {
    const view = await service.generate(TID);

    expect(stores.tournament.status).toBe("round_robin");
    expect(view.status).toBe("round_robin");
    expect(stores.courts).toHaveLength(6); // seeded from courtCount

    // 4 teams -> 3 rounds, 2 matchups each.
    expect(view.rounds).toHaveLength(3);
    for (const round of view.rounds) {
      expect(round.matchups).toHaveLength(2);
    }

    // Each matchup: roundsPerMatchup(2) x pairsPerLineup(3) = 6 games.
    const allMatchups = view.rounds.flatMap((r) => r.matchups);
    expect(allMatchups).toHaveLength(6);
    for (const m of allMatchups) {
      expect(m.games).toHaveLength(6);
    }
    expect(stores.games).toHaveLength(36);
  });

  it("never double-books a court among concurrent games", async () => {
    const view = await service.generate(TID);
    for (const round of view.rounds) {
      // Concurrency group = same matchup roundNo within an RR round.
      for (const roundNo of [1, 2]) {
        const courts = round.matchups
          .flatMap((m) => m.games)
          .filter((g) => g.roundNo === roundNo)
          .map((g) => g.courtId);
        expect(courts).toHaveLength(6);
        expect(new Set(courts).size).toBe(6);
      }
    }
  });

  it("doubles the rounds when roundRobinCycles is 2", async () => {
    stores.tournament.roundRobinCycles = 2;
    const view = await service.generate(TID);
    expect(view.rounds).toHaveLength(6);
    expect(view.rounds.flatMap((r) => r.matchups)).toHaveLength(12);
  });

  it("assigns every game a court", async () => {
    await service.generate(TID);
    expect(stores.games.every((g) => g.courtId !== null)).toBe(true);
  });

  it("rejects generation unless the team count matches config", async () => {
    stores.teams = makeTeams(3); // config wants 4
    await expect(service.generate(TID)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects generation when not in setup", async () => {
    stores.tournament.status = "round_robin";
    await expect(service.generate(TID)).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("scheduleService.updateConfig", () => {
  it("reseeds courts when courtCount changes", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.listCourts(TID); // lazily seeds 6
    expect(stores.courts).toHaveLength(6);

    await service.updateConfig(TID, { courtCount: 4 });
    expect(stores.tournament.courtCount).toBe(4);
    expect(stores.courts).toHaveLength(4);
    expect(stores.courts.map((c) => c.label)).toEqual(["Court 1", "Court 2", "Court 3", "Court 4"]);
  });

  it("rejects config edits once out of setup", async () => {
    const stores = freshStores({ status: "round_robin" });
    const service = buildService(stores);
    await expect(service.updateConfig(TID, { courtCount: 4 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects playoffQualifiers greater than teamCount", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await expect(service.updateConfig(TID, { playoffQualifiers: 5 })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects non-positive values", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await expect(service.updateConfig(TID, { courtCount: 0 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scheduleService.reassignCourt & editMatchup", () => {
  it("reassigns a game to another court", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);

    const game = stores.games[0]!;
    const otherCourt = stores.courts.find((c) => c.id !== game.courtId)!;
    await service.reassignCourt(TID, game.id, otherCourt.id);
    expect(stores.games.find((g) => g.id === game.id)!.courtId).toBe(otherCourt.id);
  });

  it("rejects reassigning to an unknown court", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);
    await expect(service.reassignCourt(TID, stores.games[0]!.id, "nope")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("swaps a matchup's teams", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);
    const m = stores.matchups[0]!;
    await service.editMatchup(TID, m.id, "team3", "team4");
    const updated = stores.matchups.find((x) => x.id === m.id)!;
    expect([updated.teamAId, updated.teamBId]).toEqual(["team3", "team4"]);
  });

  it("rejects a matchup with two identical teams", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);
    await expect(
      service.editMatchup(TID, stores.matchups[0]!.id, "team1", "team1"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("scheduleService.reset", () => {
  it("clears the schedule and returns to setup", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);
    expect(stores.matchups.length).toBeGreaterThan(0);

    await service.reset(TID);
    expect(stores.tournament.status).toBe("setup");
    expect(stores.matchups).toHaveLength(0);
    expect(stores.games).toHaveLength(0);
  });

  it("refuses to reset when a game is already final", async () => {
    const stores = freshStores();
    const service = buildService(stores);
    await service.generate(TID);
    stores.games[0]!.status = "final";
    await expect(service.reset(TID)).rejects.toBeInstanceOf(ConflictError);
  });
});
